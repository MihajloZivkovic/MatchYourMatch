namespace MatchYourMatch.WebAPI.Models
{
    public class UserProfile
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public byte[]? ProfilePictureContent { get; set; }
        public string? ProfilePictureContentType { get; set; }
        public string? ProfilePictureFileName { get; set; }
        public DateTime? ProfilePictureUpdatedAt { get; set; }
        public string? Location { get; set; }
        public string? LocationRawInput { get; set; }
        public string? LocationDisplayName { get; set; }
        public string? LocationCity { get; set; }
        public string? LocationCountry { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string LocationPrivacy { get; set; } = "CityOnly";
        public string ProfileVisibility { get; set; } = "Standard";
        public string? FullName { get; set; }
        public bool ShowFullName { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public bool ShowAge { get; set; }
        public string? LittleThingsJson { get; set; }
        public string? ExploringTagsJson { get; set; }
        public string? FavoriteActivitiesJson { get; set; }
        public int? SocialEnergy { get; set; }
        public string? ConversationStyle { get; set; }
        public string? LookingForJson { get; set; }
        public User User { get; set; } = null!;
    }
}
