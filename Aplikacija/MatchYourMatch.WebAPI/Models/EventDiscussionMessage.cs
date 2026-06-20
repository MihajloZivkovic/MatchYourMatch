namespace MatchYourMatch.WebAPI.Models
{
    public class EventDiscussionMessage
    {
        public int Id { get; set; }
        public int EventId { get; set; }
        public int UserId { get; set; }
        public required string Body { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public bool IsDeleted { get; set; }

        public Event? Event { get; set; }
        public User? User { get; set; }
    }
}
