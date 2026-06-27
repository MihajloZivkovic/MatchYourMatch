namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class GuestSessionResponseDto
    {
        public required string Token { get; set; }
        public DateTime AccessTokenExpiry { get; set; }
        public required GuestUserDto User { get; set; }
    }

    public class GuestUserDto
    {
        public required string Id { get; set; }
        public string UserType { get; set; } = "Guest";
        public string Role { get; set; } = "Guest";
        public required string City { get; set; }
    }
}
