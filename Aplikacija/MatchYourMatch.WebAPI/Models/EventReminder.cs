namespace MatchYourMatch.WebAPI.Models
{
    public class EventReminder
    {
        public int Id { get; set; }
        public int EventId { get; set; }
        public int UserId { get; set; }
        public DateTime ReminderAt { get; set; }
        public DateTime? SentAt { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public Event Event { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}
