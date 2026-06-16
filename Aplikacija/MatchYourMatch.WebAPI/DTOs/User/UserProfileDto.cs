namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class UserProfileDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public string? Location { get; set; }
        public string? LocationRawInput { get; set; }
        public string? LocationDisplayName { get; set; }
        public string? LocationPrivacy { get; set; }
        public int MatchesCount { get; set; }
        public int EventsJoinedCount { get; set; }
        public int ProfileScorePercent { get; set; }
        public int? ResponseRatePercent { get; set; }
    }
}
