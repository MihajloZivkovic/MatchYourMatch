namespace MatchYourMatch.WebAPI.Models
{
    public class ChatConversation
    {
        public int Id { get; set; }
        public int UserAId { get; set; }
        public int UserBId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LastMessageAt { get; set; }
        public bool IsHiddenForUserA { get; set; }
        public bool IsHiddenForUserB { get; set; }

        public User? UserA { get; set; }
        public User? UserB { get; set; }
        public List<ChatMessage> Messages { get; set; } = new();
    }
}
