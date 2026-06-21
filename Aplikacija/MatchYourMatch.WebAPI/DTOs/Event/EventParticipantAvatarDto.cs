namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class EventParticipantAvatarDto
    {
        public int UserId { get; set; }
        public required string Username { get; set; }
        public required string Initials { get; set; }
        public string? ProfilePicture { get; set; }
    }
}
