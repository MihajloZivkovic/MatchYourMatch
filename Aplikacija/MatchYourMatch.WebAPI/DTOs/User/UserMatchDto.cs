namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class UserMatchDto
    {
        public int UserId { get; set; }
        public string Username { get; set; } = null!;
        public string DisplayName { get; set; } = null!;
        public string Initials { get; set; } = null!;
        public string? ProfilePicture { get; set; }
        public string? LocationDisplayName { get; set; }
        public string? Bio { get; set; }
        public DateTime MatchedAt { get; set; }
        public string Source { get; set; } = "QuickMatch";
        public int? CompatibilityScore { get; set; }
        public List<string> Tags { get; set; } = new();
    }
}
