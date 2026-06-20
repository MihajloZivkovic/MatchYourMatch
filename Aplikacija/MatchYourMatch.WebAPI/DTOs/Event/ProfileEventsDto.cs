namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class ProfileEventsDto
    {
        public List<EventDto> Upcoming { get; set; } = new();
        public List<EventDto> Past { get; set; } = new();
        public List<EventDto> Saved { get; set; } = new();
    }
}
