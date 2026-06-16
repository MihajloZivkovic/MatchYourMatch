using MatchYourMatch.WebAPI.DTOs.Auth;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IAuthService
    {
        Task<AuthInfoDto> RegisterAsync(RegisterDto dto);
        Task<AuthInfoDto> LoginAsync(LoginDto dto);
        Task ForgotPasswordAsync(ForgotPasswordDto dto);
        Task ResetPasswordAsync(ResetPasswordDto dto);
    }
}
