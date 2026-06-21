using MatchYourMatch.WebAPI.DTOs.Auth;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IAuthService
    {
        Task<RegistrationResponseDto> RegisterAsync(RegisterDto dto);
        Task<AuthInfoDto> LoginAsync(LoginDto dto);
        Task VerifyEmailAsync(VerifyEmailDto dto);
        Task ResendVerificationAsync(ResendVerificationDto dto);
        Task ForgotPasswordAsync(ForgotPasswordDto dto);
        Task ResetPasswordAsync(ResetPasswordDto dto);
        Task ChangeEmailAsync(int userId, ChangeEmailDto dto);
        Task<AuthInfoDto> GoogleLoginAsync(ExternalLoginDto dto);
        Task<AuthInfoDto> FacebookLoginAsync(ExternalLoginDto dto);
        Task<AuthInfoDto> MicrosoftLoginAsync(ExternalLoginDto dto);
        Task<AuthInfoDto> CompleteSocialProfileAsync(int userId, CompleteSocialProfileDto dto);
    }
}
