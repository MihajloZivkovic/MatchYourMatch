using MatchYourMatch.WebAPI.Models;

namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class EventDto
    {
        public int Id { get; set; }
        public required string Title { get; set; }
        public string? Category { get; set; }
        public DateOnly Date { get; set; }
        public TimeOnly Time { get; set; }
        public required string Location { get; set; }
        public int MaxAttendees { get; set; }
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public required string OrganizerUsername { get; set; }
    }
}
