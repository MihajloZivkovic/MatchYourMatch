namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class RegistrationResponseDto
    {
        public string Message { get; set; } = "Registration successful. Please verify your email.";
        public bool RequiresEmailVerification { get; set; } = true;
        public string Email { get; set; } = string.Empty;
    }
}
