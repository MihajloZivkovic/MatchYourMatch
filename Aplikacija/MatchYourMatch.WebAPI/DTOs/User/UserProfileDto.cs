namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class UserProfileDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = null!;
        public string Email { get; set; } = null!;
        public string? PendingEmail { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public string? Location { get; set; }
        public string? LocationRawInput { get; set; }
        public string? LocationDisplayName { get; set; }
        public string? LocationPrivacy { get; set; }
        public string ProfileVisibility { get; set; } = "Standard";
        public int MatchesCount { get; set; }
        public int EventsJoinedCount { get; set; }
        public int ProfileScorePercent { get; set; }
        public int? ResponseRatePercent { get; set; }
        public int FollowersCount { get; set; }
        public int FollowingCount { get; set; }
        public decimal? AverageRating { get; set; }
        public int RatingsCount { get; set; }
        public string? FullName { get; set; }
        public bool ShowFullName { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public bool ShowAge { get; set; }
        public int? Age { get; set; }
        public List<string> LittleThings { get; set; } = new();
        public List<string> CurrentlyExploring { get; set; } = new();
        public List<string> FavoriteActivities { get; set; } = new();
        public int? SocialEnergy { get; set; }
        public string? ConversationStyle { get; set; }
        public List<string> LookingFor { get; set; } = new();
    }
}
