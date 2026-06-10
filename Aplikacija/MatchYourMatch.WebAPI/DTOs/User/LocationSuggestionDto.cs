namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class LocationSuggestionDto
    {
        public string LocationInput { get; set; } = string.Empty;

        public string DisplayName { get; set; } = string.Empty;

        public string? City { get; set; }

        public string? Country { get; set; }
    }
}
