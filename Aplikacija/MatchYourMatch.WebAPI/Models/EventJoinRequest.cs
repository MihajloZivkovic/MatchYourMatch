namespace MatchYourMatch.WebAPI.Models
{
    public class EventJoinRequest
    {
        public int Id { get; set; }
        public int EventId { get; set; }
        public int UserId { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? RespondedAt { get; set; }

        public Event Event { get; set; } = null!;
        public User User { get; set; } = null!;
    }
}
