using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Auth;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

namespace MatchYourMatch.WebAPI.Services
{
    public class AuthService : IAuthService
    {
        private readonly IConfiguration _config;
        private readonly AppDbContext _context;
        private readonly EmailService _emailService;
        private readonly GoogleTokenValidator _googleTokenValidator;
        private readonly MicrosoftTokenValidator _microsoftTokenValidator;

        private readonly string _issuer;
        private readonly string _audience;
        private readonly string _secret;
        private readonly int _expires;

        public AuthService(IConfiguration config, AppDbContext context, EmailService service,
            GoogleTokenValidator googleTokenValidator,
            MicrosoftTokenValidator microsoftTokenValidator)
        {
            _config = config;
            _context = context;
            _emailService = service;
            _googleTokenValidator = googleTokenValidator;
            _microsoftTokenValidator = microsoftTokenValidator;

            _issuer = _config["JwtSettings:Issuer"]!;
            _audience = _config["JwtSettings:Audience"]!;
            _secret = _config["JwtSettings:Secret"]!;
            _expires = int.Parse(_config["JwtSettings:ExpiresInMinutes"]!);
        }

        public async Task<RegistrationResponseDto> RegisterAsync(RegisterDto dto)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            var username = dto.Username.Trim();
            var role = NormalizePublicRegistrationRole(dto.AccountType, dto.Role);
            var displayName = dto.FullName?.Trim();
            if (string.IsNullOrWhiteSpace(displayName))
                throw new Exception(role == "Organizer" ? "Organization name is required." : "Full name is required.");

            if (role == "User")
            {
                if (!dto.DateOfBirth.HasValue)
                    throw new Exception("Date of birth is required.");

                var latestAllowedDate = DateOnly.FromDateTime(DateTime.Today).AddYears(-16);
                if (dto.DateOfBirth.Value > latestAllowedDate)
                    throw new Exception("You must be at least 16 years old.");
            }

            AccountService.ValidatePassword(dto.Password);

            if (await _context.Users.AnyAsync(u => u.Email == email))
                throw new Exception("Email is already in use.");
            if (await _context.Users.AnyAsync(u => u.Username == username))
                throw new Exception("Username is already in use.");

            var verificationCode = GenerateVerificationCode();

            var user = new User
            {
                Username = username,
                Email = email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
                Role = role,
                EmailConfirmed = false,
                EmailVerificationCodeHash = HashVerificationCode(verificationCode),
                EmailVerificationCodeExpiresAt = DateTime.UtcNow.AddMinutes(15),
                EmailVerificationCodeSentAt = DateTime.UtcNow
            };

            user.Profile = new UserProfile
            {
                FullName = displayName,
                DateOfBirth = role == "User" ? dto.DateOfBirth : null,
                Bio = role == "Organizer" && !string.IsNullOrWhiteSpace(dto.OrganizationType) ? dto.OrganizationType.Trim() : null,
                ShowFullName = false,
                ShowAge = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            await _emailService.SendEmailVerificationAsync(email, verificationCode);
            return new RegistrationResponseDto 
            { 
                Email = email 
            };
        }

        public async Task<AuthInfoDto> LoginAsync(LoginDto dto)
        {
            var val = (dto.EmailOrUsername ?? dto.Identifier ?? dto.Email)?.Trim();
            if (string.IsNullOrWhiteSpace(val))
                throw new Exception("Invalid email/username or password.");

            User? user;
            if (val.Contains("@"))
            {
                user = await _context.Users
                    .Include(u => u.Profile)
                    .FirstOrDefaultAsync(u => u.Email == val.ToLowerInvariant());
            }
            else
            {
                user = await _context.Users
                    .Include(u => u.Profile)
                    .FirstOrDefaultAsync(u => u.Username == val);
            }

            if (user == null)
                throw new Exception("Invalid email/username or password.");

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new Exception("Invalid email/username or password.");

            if (user.IsDeactivated)
                throw new AccountDeactivatedException();

            if (!user.IsActive)
                throw new AdminDeactivatedAccountException();

            if (!user.EmailConfirmed)
                throw new Exception("Please verify your email before logging in.");

            return CreateAuthResponse(user);
        }

        public async Task VerifyEmailAsync(VerifyEmailDto dto)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

            // provera i aktivacija
            if (user != null && !user.EmailConfirmed 
                && !string.IsNullOrWhiteSpace(user.EmailVerificationCodeHash) 
                && user.EmailVerificationCodeExpiresAt > DateTime.UtcNow 
                && VerificationCodeMatches(dto.Code, user.EmailVerificationCodeHash))
            {
                user.EmailConfirmed = true;
                user.EmailConfirmedAt = DateTime.UtcNow;
                user.EmailVerificationCodeHash = null;
                user.EmailVerificationCodeExpiresAt = null;
                user.EmailVerificationCodeSentAt = null;
                await _context.SaveChangesAsync();
                return;
            }

            user = await _context.Users.FirstOrDefaultAsync(u => u.PendingEmail == email);

            if (user == null || string.IsNullOrWhiteSpace(user.PendingEmail) ||
                string.IsNullOrWhiteSpace(user.PendingEmailVerificationCodeHash) ||
                user.PendingEmailVerificationCodeExpiresAt <= DateTime.UtcNow ||
                !VerificationCodeMatches(dto.Code, user.PendingEmailVerificationCodeHash))
                throw new Exception("Kod za verifikaciju nije validan ili je istekao.");

            if (await _context.Users.AnyAsync(u => u.Id != user.Id && u.Email == email))
                throw new Exception("Email vec u upotrebi.");

            user.Email = user.PendingEmail;
            user.EmailConfirmed = true;
            user.EmailConfirmedAt = DateTime.UtcNow;
            user.PendingEmail = null;
            user.PendingEmailVerificationCodeHash = null;
            user.PendingEmailVerificationCodeExpiresAt = null;
            user.PendingEmailVerificationCodeSentAt = null;
            user.TokenVersion++;
            
            await _context.SaveChangesAsync();
        }

        public async Task ResendVerificationAsync(ResendVerificationDto dto)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || user.EmailConfirmed) return;
            if (user.EmailVerificationCodeSentAt > DateTime.UtcNow.AddSeconds(-30)) return;

            var code = GenerateVerificationCode();
            user.EmailVerificationCodeHash = HashVerificationCode(code);
            user.EmailVerificationCodeExpiresAt = DateTime.UtcNow.AddMinutes(15);
            user.EmailVerificationCodeSentAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await _emailService.SendEmailVerificationAsync(email, code);
        }

        public AuthInfoDto CreateAuthResponse(User user)
        {
            var expiry = DateTime.UtcNow.AddMinutes(_expires);
            var requiresCompletion = user.Role == "User" && user.Profile?.DateOfBirth == null;

            return new AuthInfoDto
            {
                AccessToken = GenerateToken(user, expiry),
                AccessTokenExpiry = expiry,
                RequiresProfileCompletion = requiresCompletion,
                MissingFields = requiresCompletion ? new List<string> { "dateOfBirth" } : new List<string>(),
                UserInfo = new UserInfoDto
                {
                    Username = user.Username,
                    Email = user.Email,
                    Role = user.Role
                }
            };
        }

        public GuestSessionResponseDto CreateGuestSession(GuestLoginDto dto)
        {
            var city = NormalizeCityName(dto.City);
            if (string.IsNullOrWhiteSpace(city))
                throw new Exception("City is required.");

            var guestId = $"guest-{Guid.NewGuid():N}";
            var expiry = DateTime.UtcNow.AddHours(4);

            return new GuestSessionResponseDto
            {
                Token = GenerateGuestToken(guestId, city, expiry),
                AccessTokenExpiry = expiry,
                User = new GuestUserDto
                {
                    Id = guestId,
                    City = city
                }
            };
        }

        private string GenerateToken(User user, DateTime expiry)
        {
            var profileComplete = user.Role != "User" || user.Profile?.DateOfBirth != null;
            var _claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role),
                new Claim("tokenVersion", user.TokenVersion.ToString()),
                new Claim("profileComplete", profileComplete ? "true" : "false")
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _issuer,
                audience: _audience,
                claims: _claims,
                expires: expiry,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        private string GenerateGuestToken(string guestId, string city, DateTime expiry)
        {
            var claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, guestId),
                new Claim(ClaimTypes.Role, "Guest"),
                new Claim("userType", "Guest"),
                new Claim("guestCity", city),
                new Claim("profileComplete", "true")
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _issuer,
                audience: _audience,
                claims: claims,
                expires: expiry,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task ForgotPasswordAsync(ForgotPasswordDto dto)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null)
                throw new Exception("Korisnik nije pronadjen");
            
            user.ResetToken = Guid.NewGuid().ToString();
            user.ResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            await _emailService.SendResetEmailAsync(email, user.ResetToken);
        }

        public async Task ResetPasswordAsync(ResetPasswordDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.ResetToken == dto.Token);
            if (user == null)
                throw new Exception("Token ne postoji");

            if (user.ResetTokenExpiry < DateTime.UtcNow)
                throw new Exception("Token istekao");

            AccountService.ValidatePassword(dto.NewPassword);

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
            user.ResetToken = null;
            user.ResetTokenExpiry = null;
            await _context.SaveChangesAsync();
        }

        public async Task ChangeEmailAsync(int userId, ChangeEmailDto dto)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception("User ne postoji");

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new Exception("Netacna lozinka!");

            var newEmail = dto.NewEmail.Trim().ToLowerInvariant();
            if (await _context.Users.AnyAsync(u => u.Id != userId && u.Email == newEmail))
                throw new Exception("Email je vec u upotrebi!");

            var code = GenerateVerificationCode();
            user.PendingEmail = newEmail;
            user.PendingEmailVerificationCodeHash = HashVerificationCode(code);
            user.PendingEmailVerificationCodeExpiresAt = DateTime.UtcNow.AddMinutes(15);
            user.PendingEmailVerificationCodeSentAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            await _emailService.SendEmailVerificationAsync(newEmail, code);
        }

        public async Task<AuthInfoDto> GoogleLoginAsync(ExternalLoginDto dto)
        {
            var identity = await _googleTokenValidator.ValidateAsync(dto.IdToken);
            return await SignInExternalAsync(identity);
        }

        public async Task<AuthInfoDto> MicrosoftLoginAsync(ExternalLoginDto dto)
        {
            var identity = await _microsoftTokenValidator.ValidateAsync(dto.IdToken);
            return await SignInExternalAsync(identity);
        }

        private async Task<AuthInfoDto> SignInExternalAsync(ExternalIdentity identity)
        {
            if (!identity.EmailVerified) throw new Exception($"{identity.Provider} email must be verified.");
            var external = await _context.ExternalLogins.Include(x => x.User).ThenInclude(u => u.Profile)
                .FirstOrDefaultAsync(x => x.Provider == identity.Provider && x.ProviderUserId == identity.Subject);
            User? user;
            if (external != null) user = external.User;
            else
            {
                user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Email == identity.Email);
                if (user != null && !user.EmailConfirmed)
                    throw new Exception($"This email cannot be linked to {identity.Provider} login.");
                if (user == null)
                {
                    var username = await CreateUniqueUsernameAsync(identity.Email.Split('@')[0]);
                    user = new User
                    {
                        Username = username, Email = identity.Email,
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(Convert.ToHexString(RandomNumberGenerator.GetBytes(32))),
                        Role = "User",
                        HasPassword = false,
                        EmailConfirmed = identity.EmailVerified,
                        EmailConfirmedAt = identity.EmailVerified ? DateTime.UtcNow : null,
                        Profile = new UserProfile { FullName = identity.Name, ProfilePicture = identity.Picture, ShowFullName = false, ShowAge = false }
                    };
                    _context.Users.Add(user);
                }
                _context.ExternalLogins.Add(new ExternalLogin { User = user, Provider = identity.Provider, ProviderUserId = identity.Subject, ProviderEmail = identity.Email });
                await _context.SaveChangesAsync();
            }
            if (user.IsDeactivated) throw new AccountDeactivatedException();
            if (!user.IsActive) throw new AdminDeactivatedAccountException();
            if (!user.EmailConfirmed) throw new Exception("Please verify your email before logging in.");
            return CreateAuthResponse(user);
        }

        public async Task<AuthInfoDto> CompleteSocialProfileAsync(int userId, CompleteSocialProfileDto dto)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) throw new Exception("User does not exist.");
            if (!string.Equals(user.Role, "User", StringComparison.OrdinalIgnoreCase))
            {
                if (!string.IsNullOrWhiteSpace(dto.Username) && !string.Equals(dto.Username.Trim(), user.Username, StringComparison.OrdinalIgnoreCase))
                {
                    var username = dto.Username.Trim();
                    if (await _context.Users.AnyAsync(x => x.Id != userId && x.Username == username)) throw new Exception("Username is already in use.");
                    user.Username = username;
                }
                user.Profile ??= new UserProfile { UserId = userId };
                if (!string.IsNullOrWhiteSpace(dto.FullName)) user.Profile.FullName = dto.FullName.Trim();
                await _context.SaveChangesAsync();
                return CreateAuthResponse(user);
            }
            if (!dto.DateOfBirth.HasValue || dto.DateOfBirth > DateOnly.FromDateTime(DateTime.Today).AddYears(-16))
                throw new Exception("You must be at least 16 years old.");
            if (!string.IsNullOrWhiteSpace(dto.Username) && !string.Equals(dto.Username.Trim(), user.Username, StringComparison.OrdinalIgnoreCase))
            {
                var username = dto.Username.Trim();
                if (await _context.Users.AnyAsync(x => x.Id != userId && x.Username == username)) throw new Exception("Username is already in use.");
                user.Username = username;
            }
            user.Profile ??= new UserProfile { UserId = userId };
            user.Profile.DateOfBirth = dto.DateOfBirth;
            if (!string.IsNullOrWhiteSpace(dto.FullName)) user.Profile.FullName = dto.FullName.Trim();
            await _context.SaveChangesAsync();
            return CreateAuthResponse(user);
        }

        private async Task<string> CreateUniqueUsernameAsync(string source)
        {
            var baseName = new string(source.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(baseName)) baseName = "mymuser";
            baseName = baseName[..Math.Min(baseName.Length, 90)];
            var candidate = baseName; var suffix = 1;
            while (await _context.Users.AnyAsync(x => x.Username == candidate)) candidate = $"{baseName}{suffix++}";
            return candidate;
        }

        private static string NormalizeCityName(string? value)
        {
            return (value ?? string.Empty)
                .Trim()
                .Replace("NiÅ¡", "Niš", StringComparison.OrdinalIgnoreCase)
                .Replace("Nis", "Niš", StringComparison.OrdinalIgnoreCase)
                .Replace("NISH", "Niš", StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizePublicRegistrationRole(string? accountType, string? legacyRole)
        {
            var raw = !string.IsNullOrWhiteSpace(accountType) ? accountType : legacyRole;
            raw = raw?.Trim();
            if (string.IsNullOrWhiteSpace(raw) || raw.Equals("Regular user", StringComparison.OrdinalIgnoreCase) ||
                raw.Equals("RegularUser", StringComparison.OrdinalIgnoreCase))
                return "User";
            if (raw.Equals("User", StringComparison.OrdinalIgnoreCase))
                return "User";
            if (raw.Equals("Organizer", StringComparison.OrdinalIgnoreCase))
                return "Organizer";

            throw new Exception("Invalid account type.");
        }

        private static string GenerateVerificationCode() 
            => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        private static string HashVerificationCode(string code) 
            => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

        private static bool VerificationCodeMatches(string code, string storedHash)
        {
            try
            {
                return CryptographicOperations.FixedTimeEquals(
                    SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim())),
                    Convert.FromHexString(storedHash));
            }
            catch { 
                return false; 
            }
        }
    }
}
