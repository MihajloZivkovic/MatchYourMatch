namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class PublicUserProfileDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public string? LocationDisplayName { get; set; }
        public List<InterestDto> Interests { get; set; } = new();
    }
}
