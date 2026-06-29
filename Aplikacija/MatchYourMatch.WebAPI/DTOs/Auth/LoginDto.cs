namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class LoginDto
    {
        public string? EmailOrUsername { get; set; }
        public string? Identifier { get; set; }
        public string? Email { get; set; }
        public required string Password { get; set; }
    }
}
