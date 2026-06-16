namespace MatchYourMatch.WebAPI.Models
{
    public class Event
    {
        public int Id { get; set; }
        public required string Title { get; set; }
        public int? OrganizerId { get; set; }
        public int? InterestId { get; set; }
        public DateOnly Date { get; set; }
        public TimeOnly Time { get; set; }
        public required string Location { get; set; }
        public int MaxAttendees { get; set; }
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public User? Organizer { get; set; }
        public Interest? Interest { get; set; }
        public List<EventParticipant> Participants { get; set; } = new();
    }
}
