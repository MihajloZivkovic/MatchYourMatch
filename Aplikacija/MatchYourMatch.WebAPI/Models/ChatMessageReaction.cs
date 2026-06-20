namespace MatchYourMatch.WebAPI.Models
{
    public class ChatMessageReaction
    {
        public int Id { get; set; }
        public int MessageId { get; set; }
        public int UserId { get; set; }
        public required string Emoji { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ChatMessage? Message { get; set; }
        public User? User { get; set; }
    }
}
