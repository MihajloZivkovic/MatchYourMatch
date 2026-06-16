namespace MatchYourMatch.WebAPI.Models
{
    public class ChatMessage
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public int SenderId { get; set; }
        public int ReceiverId { get; set; }
        public required string Body { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReadAt { get; set; }
        public DateTime? EditedAt { get; set; }
        public bool IsDeletedForEveryone { get; set; }
        public DateTime? DeletedAt { get; set; }
        public bool IsDeletedForSender { get; set; }
        public bool IsDeletedForReceiver { get; set; }

        public ChatConversation? Conversation { get; set; }
        public User? Sender { get; set; }
        public User? Receiver { get; set; }
    }
}
