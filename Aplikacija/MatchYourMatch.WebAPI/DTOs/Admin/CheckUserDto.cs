namespace MatchYourMatch.WebAPI.DTOs.Admin
{
    public class CheckUserDto
    {
        public int Id { get; set; }
        public required string Username { get; set; }
        public required string Email { get; set; }
        public required string Role { get; set; }
        public required bool IsActive { get; set; }
    }
}
