namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class UserInfoDto
    {
        public required string Username { get; set; }
        public required string Email { get; set; }
        public required string Role { get; set; }
    }
}
