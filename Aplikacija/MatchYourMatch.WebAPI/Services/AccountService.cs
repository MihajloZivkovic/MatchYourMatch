using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Account;
using MatchYourMatch.WebAPI.DTOs.Auth;
using MatchYourMatch.WebAPI.DTOs.User;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace MatchYourMatch.WebAPI.Services;

public class AccountService : IAccountService
{
    private readonly AppDbContext _context;
    private readonly IAuthService _authService;
    private readonly IUserProfilesService _profiles;
    private readonly EmailService _emailService;
    private readonly GoogleTokenValidator _google;
    private readonly MicrosoftTokenValidator _microsoft;

    public AccountService(AppDbContext context, IAuthService authService, IUserProfilesService profiles, EmailService emailService, GoogleTokenValidator google,
        MicrosoftTokenValidator microsoft, ILogger<AccountService> logger)
    {
        _context = context;
        _authService = authService;
        _profiles = profiles;
        _emailService = emailService;
        _google = google;
        _microsoft = microsoft;
    }

    public async Task<AccountStatusDto> GetStatusAsync(int userId)
    {
        var user = await _context.Users.AsNoTracking().FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new KeyNotFoundException("Nalog ne postoji.");
        return new AccountStatusDto
        {
            HasPassword = user.HasPassword,
            HasExternalLogin = await _context.ExternalLogins.AnyAsync(x => x.UserId == userId)
        };
    }

    public async Task<UserProfileDto> UpdateUsernameAsync(int userId, UpdateUsernameDto dto)
    {
        var username = NormalizeUsername(dto.Username);
        var user = await _context.Users.Include(x => x.Profile).FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new KeyNotFoundException("Nalog ne postoji.");
            
        if (await _context.Users.AnyAsync(x => x.Id != userId && x.Username.ToLower() == username.ToLowerInvariant()))
            throw new InvalidOperationException("Username se vec koristi.");

        user.Username = username;
        await _context.SaveChangesAsync();
        return await _profiles.GetProfileAsync(userId);
    }

    public async Task<object> UpdateEmailAsync(int userId, UpdateEmailDto dto)
    {
        var newEmail = NormalizeEmail(dto.NewEmail);
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new KeyNotFoundException("Account does not exist.");
        EnsurePassword(user, dto.Password);

        if (string.Equals(user.Email, newEmail, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Email vec aktivan na ovog nalogu.");
        if (await _context.Users.AnyAsync(x => x.Id != userId && x.Email == newEmail))
            throw new InvalidOperationException("Email je vec u upotrebi.");
        if (await _context.Users.AnyAsync(x => x.Id != userId && x.PendingEmail == newEmail))
            throw new InvalidOperationException("Email ceka verifikaciju.");

        var code = GenerateVerificationCode();
        user.PendingEmail = newEmail;
        user.PendingEmailVerificationCodeHash = HashVerificationCode(code);
        user.PendingEmailVerificationCodeExpiresAt = DateTime.UtcNow.AddMinutes(15);
        user.PendingEmailVerificationCodeSentAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
        await _emailService.SendEmailVerificationAsync(newEmail, code);

        return new
        {
            success = true,
            message = "Verification code sent to the new email address.",
            email = user.Email,
            pendingEmail = newEmail
        };
    }

    public async Task ChangePasswordAsync(int userId, UpdatePasswordDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new KeyNotFoundException("Nalog ne postoji.");
        EnsurePassword(user, dto.CurrentPassword);

        if (dto.NewPassword != dto.ConfirmNewPassword)
            throw new InvalidOperationException("Lozinke se ne poklapaju.");
        ValidatePassword(dto.NewPassword);

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.NewPassword);
        user.HasPassword = true;
        user.TokenVersion++;
        await _context.SaveChangesAsync();
    }

    public async Task<UserProfileDto> UpdateProfileVisibilityAsync(int userId, UpdateProfileVisibilityDto dto)
    {
        var visibility = NormalizeProfileVisibility(dto.ProfileVisibility);
        var user = await _context.Users.Include(x => x.Profile).FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new KeyNotFoundException("Nalog ne postoji.");
        user.Profile ??= new UserProfile 
        { 
            UserId = userId 
        };
        user.Profile.ProfileVisibility = visibility;
        await _context.SaveChangesAsync();
        return await _profiles.GetProfileAsync(userId);
    }

    public async Task DeactivateAsync(int userId, DeactivateAccountDto dto)
    {
        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new KeyNotFoundException("Nalog ne postoji.");
        EnsureAccountConfirmation(user, dto.Password, dto.Confirmation, "DEACTIVATE");

        if (user.IsDeactivated) 
            return;

        user.IsDeactivated = true;
        user.IsActive = false;
        user.DeactivatedAt = DateTime.UtcNow;
        user.TokenVersion++;

        // Deaktivacija meceva i postova korisnika
        await _context.QuickMatchPosts.Where(x => x.UserId == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsActive, false));
        await _context.UserMatches.Where(x => x.UserAId == userId || x.UserBId == userId)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.IsActive, false));

        await _context.SaveChangesAsync();
    }

    public async Task<AuthInfoDto> ReactivateAsync(ReactivateAccountDto dto)
    {
        User user;
        if (string.IsNullOrWhiteSpace(dto.Provider))
        {
            var val = dto.Email?.Trim();
            User? found;
           
            // proveravamo da li je korisnik identifikovan mejlom ili sa username
            if (!string.IsNullOrWhiteSpace(val) && val.Contains('@'))
            {
                found = await _context.Users
                    .Include(x => x.Profile).FirstOrDefaultAsync(x => x.Email == val.ToLowerInvariant());
            }
            else
            {
                found = await _context.Users
                    .Include(x => x.Profile).FirstOrDefaultAsync(x => x.Username == val);
            }
            
            user = found 
                ?? throw new UnauthorizedAccessException("Email ili password su netacni.");

            if (!user.HasPassword || string.IsNullOrWhiteSpace(dto.Password) ||
                !BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new UnauthorizedAccessException("Email ili password su netacni.");
        }
        else
        {
            var identity = await ValidateExternalIdentityAsync(dto);
            var external = await _context.ExternalLogins.Include(x => x.User).ThenInclude(x => x.Profile)
                .FirstOrDefaultAsync(x => x.Provider == identity.Provider && x.ProviderUserId == identity.Subject)
                ?? throw new UnauthorizedAccessException("Nalog nije povezan sa MatchYourMatch.");

            if (!identity.EmailVerified || !string.Equals(
                    external.ProviderEmail ?? external.User.Email, identity.Email, StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Eksterna verifikacija neuspesna.");

            user = external.User;
        }

        if (!user.IsDeactivated) 
            throw new InvalidOperationException("Nalog je vec aktivan.");
        user.IsDeactivated = false;
        user.IsActive = true;
        user.DeactivatedAt = null;
        user.TokenVersion++;

        await _context.SaveChangesAsync();
        return _authService.CreateAuthResponse(user);
    }

    public async Task DeleteAsync(int userId, DeleteAccountDto dto)
    {
        if (!string.Equals(dto.Confirmation?.Trim(), "DELETE", StringComparison.Ordinal))
            throw new InvalidOperationException("Type DELETE to permanently delete the account.");

        await using var transaction = await _context.Database.BeginTransactionAsync();

        var user = await _context.Users.FirstOrDefaultAsync(x => x.Id == userId)
            ?? throw new KeyNotFoundException("Account does not exist.");

        if (user.Role == "System" || string.Equals(user.Role, "Admin", StringComparison.OrdinalIgnoreCase))
            throw new UnauthorizedAccessException("Nalog ne moze biti obrisan.");

        EnsureAccountConfirmation(user, dto.Password, dto.Confirmation, "DELETE");

        var deletedUser = await GetOrCreateDeletedUserAsync();
        await DeletePrivateChatConversationsAsync(userId);
        await PreserveHistoricalContentAsync(userId, deletedUser.Id);
        await RemoveUserRelationsAsync(userId);
        await DeleteUserRecordAsync(user);

        await transaction.CommitAsync();
    }

    private async Task DeletePrivateChatConversationsAsync(int userId)
    {
        var conversationIdsToDelete = await _context.ChatConversations
            .Where(c => (!c.IsGroup && (c.UserAId == userId || c.UserBId == userId)) ||
                (c.IsGroup && c.Members.Any(m => m.UserId == userId) && !c.Members.Any(m => m.UserId != userId)))
            .Select(c => c.Id)
            .ToListAsync();

        if (conversationIdsToDelete.Count > 0)
        {
            var messageIds = _context.ChatMessages
                .Where(m => conversationIdsToDelete.Contains(m.ConversationId))
                .Select(m => m.Id);

            await _context.ChatMessageReactions.Where(x => messageIds.Contains(x.MessageId)).ExecuteDeleteAsync();
            await _context.ChatMessageUserDeletions.Where(x => messageIds.Contains(x.MessageId)).ExecuteDeleteAsync();
            await _context.ChatMessages.Where(x => conversationIdsToDelete.Contains(x.ConversationId)).ExecuteDeleteAsync();
            await _context.ChatConversationMembers.Where(x => conversationIdsToDelete.Contains(x.ConversationId)).ExecuteDeleteAsync();
            await _context.ChatConversations.Where(x => conversationIdsToDelete.Contains(x.Id)).ExecuteDeleteAsync();
        }
    }

    private async Task PreserveHistoricalContentAsync(int userId, int deletedUserId)
    {
        await _context.ChatConversations.Where(x => x.IsGroup && x.CreatedByUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.CreatedByUserId, (int?)null));
        await _context.ChatConversations.Where(x => x.UserAId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserAId, (int?)null));
        await _context.ChatConversations.Where(x => x.UserBId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserBId, (int?)null));
        await _context.ChatMessages.Where(x => x.SenderId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.SenderId, deletedUserId));
        await _context.ChatMessages.Where(x => x.ReceiverId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReceiverId, (int?)null));
        await _context.EventDiscussionMessages.Where(x => x.UserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.UserId, deletedUserId));
        await _context.Events.Where(x => x.OrganizerId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.OrganizerId, (int?)null));
        await _context.Notifications.Where(x => x.ActorUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ActorUserId, (int?)null));
        await _context.UserReports.Where(x => x.ReviewedByUserId == userId)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.ReviewedByUserId, (int?)null));
    }

    private async Task RemoveUserRelationsAsync(int userId)
    {
        await _context.ChatMessageReactions.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.ChatMessageUserDeletions.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.ChatConversationMembers.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.Notifications.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.EventInvites.Where(x => x.InviterUserId == userId || x.InviteeUserId == userId).ExecuteDeleteAsync();
        await _context.UserReports.Where(x => x.ReporterUserId == userId || x.ReportedUserId == userId).ExecuteDeleteAsync();
        await _context.UserRatings.Where(x => x.RaterUserId == userId || x.RatedUserId == userId).ExecuteDeleteAsync();
        await _context.UserMatches.Where(x => x.UserAId == userId || x.UserBId == userId).ExecuteDeleteAsync();
        await _context.Follows.Where(x => x.FollowerId == userId || x.FollowingId == userId).ExecuteDeleteAsync();
        await _context.BlockedUsers.Where(x => x.BlockerUserId == userId || x.BlockedUserId == userId).ExecuteDeleteAsync();
        await _context.HiddenProfiles.Where(x => x.UserId == userId || x.HiddenUserId == userId).ExecuteDeleteAsync();
        await _context.EventParticipants.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.EventReminders.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.EventJoinRequests.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.SavedEvents.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.QuickMatchRequests.Where(x => x.RequesterUserId == userId).ExecuteDeleteAsync();
        await _context.QuickMatchPosts.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.OrganizerSubscriptions.Where(x => x.UserId == userId || x.OrganizerId == userId).ExecuteDeleteAsync();
        await _context.FreeTimeSlots.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.UserInterests.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.UserDeepMatchPreferences.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.UserAppSettings.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.UserProfiles.Where(x => x.UserId == userId).ExecuteDeleteAsync();
        await _context.ExternalLogins.Where(x => x.UserId == userId).ExecuteDeleteAsync();
    }

    private async Task DeleteUserRecordAsync(User user)
    {
        var deletedRows = await _context.Users
            .Where(x => x.Id == user.Id)
            .ExecuteDeleteAsync();

        if (deletedRows != 1)
            throw new InvalidOperationException("Account could not be deleted.");
    }

    private void EnsureAccountConfirmation(User user, string? password, string? confirmation, string requiredConfirmation)
    {
        if (user.HasPassword)
        {
            if (string.IsNullOrWhiteSpace(password) || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
                throw new UnauthorizedAccessException("Trenutna lozinka netacna.");
        }
        else if (!string.Equals(confirmation?.Trim(), requiredConfirmation, StringComparison.Ordinal))
        {
            throw new InvalidOperationException($"Type {requiredConfirmation} to confirm this action.");
        }
    }

    private static void EnsurePassword(User user, string? password)
    {
        if (!user.HasPassword)
            throw new UnauthorizedAccessException("Password sign-in is not enabled for this account.");
        if (string.IsNullOrWhiteSpace(password) || !BCrypt.Net.BCrypt.Verify(password, user.PasswordHash))
            throw new UnauthorizedAccessException("Trenutna lozinka netacna.");
    }

    private static string NormalizeUsername(string? username)
    {
        var value = username?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Username is required.");
        if (value.Length is < 3 or > 30)
            throw new InvalidOperationException("Username must be between 3 and 30 characters.");
        if (!Regex.IsMatch(value, "^[A-Za-z0-9._-]+$"))
            throw new InvalidOperationException("Username can contain only letters, numbers, dots, underscores and hyphens.");
        return value;
    }

    private static string NormalizeEmail(string? email)
    {
        var value = email?.Trim().ToLowerInvariant() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(value))
            throw new InvalidOperationException("Email is required.");
        if (!new EmailAddressAttribute().IsValid(value))
            throw new InvalidOperationException("Email format is invalid.");
        return value;
    }

    public static void ValidatePassword(string? password)
    {
        if (!IsPasswordValid(password))
            throw new WeakPasswordException();
    }

    private static bool IsPasswordValid(string? password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8)
            return false;

        return password.Any(char.IsUpper)
            && password.Any(char.IsLower)
            && password.Any(char.IsDigit)
            && password.Any(value => !char.IsLetterOrDigit(value));
    }

    private static string NormalizeProfileVisibility(string? visibility)
    {
        var value = visibility?.Trim();
        if (string.Equals(value, "Public", StringComparison.OrdinalIgnoreCase)) 
            return "Public";
        if (string.Equals(value, "Standard", StringComparison.OrdinalIgnoreCase)) 
            return "Standard";
        if (string.Equals(value, "Private", StringComparison.OrdinalIgnoreCase)) 
            return "Private";
        throw new InvalidOperationException("Profile visibility must be public, standard or private");
    }

    private static string GenerateVerificationCode() 
        => RandomNumberGenerator.GetInt32(0, 1_000_000).ToString("D6");

    private static string HashVerificationCode(string code) 
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(code)));

    private async Task<ExternalIdentity> ValidateExternalIdentityAsync(ReactivateAccountDto dto) =>
        dto.Provider?.Trim().ToLowerInvariant() switch
        {
            "google" => await _google.ValidateAsync(dto.IdToken),
            "microsoft" => await _microsoft.ValidateAsync(dto.IdToken),
            _ => throw new InvalidOperationException("Greska")
        };

    private async Task<User> GetOrCreateDeletedUserAsync()
    {
        const string email = "deleted-user@mym.invalid";
        var deleted = await _context.Users.FirstOrDefaultAsync(x => x.Email == email);
        if (deleted != null) return deleted;
        deleted = new User
        {
            Username = "deleted_user",
            Email = email,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
            Role = "System",
            IsActive = false,
            IsDeactivated = true,
            DeactivatedAt = DateTime.UtcNow,
            EmailConfirmed = true,
            HasPassword = false,
            TokenVersion = 1
        };
        _context.Users.Add(deleted);
        await _context.SaveChangesAsync();
        return deleted;
    }
}

public class WeakPasswordException : Exception
{
    public const string DefaultCode = "WEAK_PASSWORD";

    public WeakPasswordException()
        : base("Password must be at least 8 characters long and include uppercase, lowercase, number and special character.")
    {
    }

    public string Code => DefaultCode;
}
