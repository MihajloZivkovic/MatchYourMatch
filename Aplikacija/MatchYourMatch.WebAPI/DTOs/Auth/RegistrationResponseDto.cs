namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class RegistrationResponseDto
    {
        public string Message { get; set; } = "Registration successful. Please check your email to verify your account.";
        public bool RequiresEmailVerification { get; set; } = true;
        public string Email { get; set; } = string.Empty;
    }
}
