namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class CreateEventDto
    {
        public required string Title { get; set; }
        public required string Category { get; set; } // ime interesta
        public string? Description { get; set; }
        public string? Location { get; set; }
        public bool ShowFullAddress { get; set; } = false;
        public DateOnly Date { get; set; }
        public TimeOnly Time { get; set; }
        public int MaxAttendees { get; set; }
        public int? MinAge { get; set; }
        public int? MaxAge { get; set; }
        public bool RequiresParticipantApproval { get; set; }
        public string? ImageUrl { get; set; }
    }   
}
