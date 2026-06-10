namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class DeepMatchPreferenceDto
    {
        public string? RelationshipValue { get; set; }

        public string? CommunicationStyle { get; set; }

        public string? FreeTimePreference { get; set; }

        public string? SocialEnergy { get; set; }

        public string? RelationshipPace { get; set; }

        public string? ImportantValues { get; set; }

        public string? LifestylePreferences { get; set; }

        public bool IsComplete { get; set; }
    }
}
