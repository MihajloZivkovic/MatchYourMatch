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

        private readonly string _issuer;
        private readonly string _audience;
        private readonly string _secret;
        private readonly int _expires;

        public AuthService(IConfiguration config, AppDbContext context, EmailService service)
        {
            _config = config;
            _context = context;
            _emailService = service;

            _issuer = _config["JwtSettings:Issuer"]!;
            _audience = _config["JwtSettings:Audience"]!;
            _secret = _config["JwtSettings:Secret"]!;
            _expires = int.Parse(_config["JwtSettings:ExpiresInMinutes"]!);
        }

        public async Task<RegistrationResponseDto> RegisterAsync(RegisterDto dto)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            var username = dto.Username.Trim();
            var fullName = dto.FullName?.Trim();
            if (string.IsNullOrWhiteSpace(fullName))
                throw new Exception("Full name is required.");

            if (!dto.DateOfBirth.HasValue)
                throw new Exception("Date of birth is required.");

            var latestAllowedDate = DateOnly.FromDateTime(DateTime.Today).AddYears(-16);
            if (dto.DateOfBirth.Value > latestAllowedDate)
                throw new Exception("You must be at least 16 years old.");

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
                Role = dto.Role,
                EmailConfirmed = false,
                EmailVerificationCodeHash = HashVerificationCode(verificationCode),
                EmailVerificationCodeExpiresAt = DateTime.UtcNow.AddMinutes(15),
                EmailVerificationCodeSentAt = DateTime.UtcNow
            };

            user.Profile = new UserProfile
            {
                FullName = fullName,
                DateOfBirth = dto.DateOfBirth,
                ShowFullName = false,
                ShowAge = false
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            await _emailService.SendEmailVerificationAsync(email, verificationCode);
            return new RegistrationResponseDto { Email = email };
        }

        public async Task<AuthInfoDto> LoginAsync(LoginDto dto)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

            if (user == null)
                throw new Exception("Pogresan email.");

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new Exception("Pogresna lozinka.");

            if (!user.IsActive) 
                throw new Exception("Nalog je deaktiviran.");

            if (!user.EmailConfirmed)
                throw new Exception("Please verify your email before logging in.");

            return GenerateResponse(user);
        }

        public async Task VerifyEmailAsync(VerifyEmailDto dto)
        {
            var email = dto.Email.Trim().ToLowerInvariant();
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
            if (user == null || user.EmailConfirmed || string.IsNullOrWhiteSpace(user.EmailVerificationCodeHash) ||
                user.EmailVerificationCodeExpiresAt <= DateTime.UtcNow || !VerificationCodeMatches(dto.Code, user.EmailVerificationCodeHash))
                throw new Exception("Verification code is invalid or expired.");

            user.EmailConfirmed = true;
            user.EmailConfirmedAt = DateTime.UtcNow;
            user.EmailVerificationCodeHash = null;
            user.EmailVerificationCodeExpiresAt = null;
            user.EmailVerificationCodeSentAt = null;
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

        private AuthInfoDto GenerateResponse(User user)
        {
            var expiry = DateTime.UtcNow.AddMinutes(_expires);

            return new AuthInfoDto
            {
                AccessToken = GenerateToken(user, expiry),
                AccessTokenExpiry = expiry,
                UserInfo = new UserInfoDto
                {
                    Username = user.Username,
                    Email = user.Email,
                    Role = user.Role
                }
            };
        }

        private string GenerateToken(User user, DateTime expiry)
        {
            var _claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
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

        public async Task ForgotPasswordAsync(ForgotPasswordDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);
            if (user == null)
                throw new Exception("Korisnik nije pronadjen");
            
            user.ResetToken = Guid.NewGuid().ToString();
            user.ResetTokenExpiry = DateTime.UtcNow.AddHours(1);
            await _context.SaveChangesAsync();

            await _emailService.SendResetEmailAsync(dto.Email, user.ResetToken);
        }

        public async Task ResetPasswordAsync(ResetPasswordDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.ResetToken == dto.Token);
            if (user == null)
                throw new Exception("Token ne postoji");

            if (user.ResetTokenExpiry < DateTime.UtcNow)
                throw new Exception("Token istekao");

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

            if (await _context.Users.AnyAsync(u => u.Email == dto.NewEmail))
                throw new Exception("Email je vec u upotrebi!");

            user.Email = dto.NewEmail;
            await _context.SaveChangesAsync();
        }

        private static string GenerateVerificationCode() => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

        private static string HashVerificationCode(string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

        private static bool VerificationCodeMatches(string code, string storedHash)
        {
            try
            {
                return CryptographicOperations.FixedTimeEquals(
                    SHA256.HashData(Encoding.UTF8.GetBytes(code.Trim())),
                    Convert.FromHexString(storedHash));
            }
            catch { return false; }
        }
    }
}
