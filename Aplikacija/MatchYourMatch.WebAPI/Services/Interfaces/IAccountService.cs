using MatchYourMatch.WebAPI.DTOs.Account;
using MatchYourMatch.WebAPI.DTOs.Auth;
namespace MatchYourMatch.WebAPI.Services.Interfaces;
public interface IAccountService
{
    Task<AccountStatusDto> GetStatusAsync(int userId);
    Task DeactivateAsync(int userId, DeactivateAccountDto dto);
    Task<AuthInfoDto> ReactivateAsync(ReactivateAccountDto dto);
    Task DeleteAsync(int userId, DeleteAccountDto dto);
}
