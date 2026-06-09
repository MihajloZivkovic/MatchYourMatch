namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class EditProfileDto
    {
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public string? Location { get; set; }
        public string? LocationDisplayName { get; set; }
        public double? Latitude { get; set; }
        public double? Longitude { get; set; }
        public string? LocationPrivacy { get; set; }
    }
}
