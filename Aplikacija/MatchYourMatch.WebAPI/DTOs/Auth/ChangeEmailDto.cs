namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class ChangeEmailDto
    {
        public required string NewEmail { get; set; }
        public required string Password { get; set; }
    }
}
