namespace MatchYourMatch.WebAPI.Models
{
    public class EventInvite
    {
        public int Id { get; set; }
        public int EventId { get; set; }
        public int InviterUserId { get; set; }
        public int InviteeUserId { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? RespondedAt { get; set; }

        public Event Event { get; set; } = null!;
        public User InviterUser { get; set; } = null!;
        public User InviteeUser { get; set; } = null!;
    }
}
