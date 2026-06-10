namespace MatchYourMatch.WebAPI.Services
{
    public class GeocodingResult
    {
        public double Latitude { get; set; }

        public double Longitude { get; set; }

        public string? City { get; set; }

        public string? Country { get; set; }

        public string DisplayName { get; set; } = string.Empty;

        public string LocationInput { get; set; } = string.Empty;
    }
}
