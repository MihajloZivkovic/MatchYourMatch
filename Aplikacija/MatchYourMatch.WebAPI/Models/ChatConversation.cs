namespace MatchYourMatch.WebAPI.Models
{
    public class ChatConversation
    {
        public int Id { get; set; }
        public int? UserAId { get; set; }
        public int? UserBId { get; set; }
        public bool IsGroup { get; set; }
        public string? GroupName { get; set; }
        public string? GroupPhoto { get; set; }
        public int? EventId { get; set; }
        public int? CreatedByUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastMessageAt { get; set; }
        public bool IsHiddenForUserA { get; set; }
        public bool IsHiddenForUserB { get; set; }

        public User? UserA { get; set; }
        public User? UserB { get; set; }
        public User? CreatedByUser { get; set; }
        public Event? Event { get; set; }
        public List<ChatMessage> Messages { get; set; } = new();
        public List<ChatConversationMember> Members { get; set; } = new();
    }
}
