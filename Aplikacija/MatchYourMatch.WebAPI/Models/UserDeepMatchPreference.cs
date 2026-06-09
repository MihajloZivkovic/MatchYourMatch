namespace MatchYourMatch.WebAPI.Models
{
    public class UserDeepMatchPreference
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public string? RelationshipValue { get; set; }

        public string? CommunicationStyle { get; set; }

        public string? FreeTimePreference { get; set; }

        public string? SocialEnergy { get; set; }

        public string? RelationshipPace { get; set; }

        public string? ImportantValues { get; set; }

        public string? LifestylePreferences { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public User User { get; set; } = null!;
    }
}
