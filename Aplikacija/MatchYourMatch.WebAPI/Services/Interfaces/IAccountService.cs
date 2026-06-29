using MatchYourMatch.WebAPI.DTOs.Account;
using MatchYourMatch.WebAPI.DTOs.Auth;
using MatchYourMatch.WebAPI.DTOs.User;
namespace MatchYourMatch.WebAPI.Services.Interfaces;
public interface IAccountService
{
    Task<AccountStatusDto> GetStatusAsync(int userId);
    Task<UserProfileDto> UpdateUsernameAsync(int userId, UpdateUsernameDto dto);
    Task<object> UpdateEmailAsync(int userId, UpdateEmailDto dto);
    Task ChangePasswordAsync(int userId, UpdatePasswordDto dto);
    Task<UserProfileDto> UpdateProfileVisibilityAsync(int userId, UpdateProfileVisibilityDto dto);
    Task DeactivateAsync(int userId, DeactivateAccountDto dto);
    Task<AuthInfoDto> ReactivateAsync(ReactivateAccountDto dto);
    Task DeleteAsync(int userId, DeleteAccountDto dto);
}
