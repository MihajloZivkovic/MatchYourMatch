namespace MatchYourMatch.WebAPI.Models
{
    public class ChatConversationMember
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public int UserId { get; set; }
        public DateTime JoinedAt { get; set; } = DateTime.UtcNow;
        public DateTime? LeftAt { get; set; }
        public bool IsHidden { get; set; }
        public bool IsMuted { get; set; }
        public DateTime? LastReadAt { get; set; }
        public string Role { get; set; } = "Member";

        public ChatConversation? Conversation { get; set; }
        public User? User { get; set; }
    }
}
