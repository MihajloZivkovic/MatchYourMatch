namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class EventInviteCandidateDto
    {
        public int Id { get; set; }
        public required string Username { get; set; }
        public required string DisplayName { get; set; }
        public required string Initials { get; set; }
        public string? ProfilePicture { get; set; }
        public string? LocationDisplayName { get; set; }
    }
}
