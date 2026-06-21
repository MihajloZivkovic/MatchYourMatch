namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class EditProfileDto
    {
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public string? Location { get; set; }
        public string? LocationDisplayName { get; set; }
        public string? LocationPrivacy { get; set; }
        public string? FullName { get; set; }
        public bool ShowFullName { get; set; }
        public DateOnly? DateOfBirth { get; set; }
        public bool ShowAge { get; set; }
    }
}
