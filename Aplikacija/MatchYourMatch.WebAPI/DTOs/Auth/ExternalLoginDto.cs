namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class ExternalLoginDto
    {
        public string? IdToken { get; set; }
        public string? AccessToken { get; set; }
    }
}
