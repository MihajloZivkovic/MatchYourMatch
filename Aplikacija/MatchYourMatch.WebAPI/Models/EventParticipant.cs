namespace MatchYourMatch.WebAPI.Models
{
    public class EventParticipant
    {
        public int EventId { get; set; }
        public int UserId { get; set; }
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;

        public Event Event { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}
