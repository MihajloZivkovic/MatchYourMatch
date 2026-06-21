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
        public bool IsFollowing { get; set; }
        public int FollowersCount { get; set; }
        public int FollowingCount { get; set; }
        public decimal? AverageRating { get; set; }
        public int RatingsCount { get; set; }
        public string? FullName { get; set; }
        public int? Age { get; set; }
        public List<string> LittleThings { get; set; } = new();
        public List<string> CurrentlyExploring { get; set; } = new();
        public bool CanMessage { get; set; }
        public List<InterestDto> Interests { get; set; } = new();
    }
}
