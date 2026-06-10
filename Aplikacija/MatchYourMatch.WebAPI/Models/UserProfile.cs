namespace MatchYourMatch.WebAPI.Models
{
    public class UserProfile
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public string? Location { get; set; }
        public string? LocationRawInput { get; set; }
        public string? LocationDisplayName { get; set; }
        public string? LocationCity { get; set; }
        public string? LocationCountry { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string LocationPrivacy { get; set; } = "CityOnly";
        public User User { get; set; } = null!;
    }
}
