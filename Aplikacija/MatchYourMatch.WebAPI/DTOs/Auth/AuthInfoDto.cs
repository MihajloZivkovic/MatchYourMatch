namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class AuthInfoDto
    {
        public required string AccessToken { get; set; }
        public DateTime AccessTokenExpiry { get; set; }
        public required UserInfoDto UserInfo { get; set; }
    }
}
