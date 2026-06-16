namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class PublicUserProfileDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public string? LocationDisplayName { get; set; }
        public int MatchesCount { get; set; }
        public int EventsJoinedCount { get; set; }
        public int ProfileScorePercent { get; set; }
        public int? ResponseRatePercent { get; set; }
        public List<InterestDto> Interests { get; set; } = new();
    }
}
