namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class CreateEventDto
    {
        public required string Title { get; set; }
        public string? Category { get; set; } // ime interesta
        public string? Description { get; set; }
        public string? Location { get; set; }
        public DateOnly Date { get; set; }
        public TimeOnly Time { get; set; }
        public int MaxAttendees { get; set; }
        public string? ImageUrl { get; set; }
    }   
}