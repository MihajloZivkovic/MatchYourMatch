namespace MatchYourMatch.WebAPI.Models
{
    public class ChatMessageUserDeletion
    {
        public int Id { get; set; }
        public int MessageId { get; set; }
        public int UserId { get; set; }
        public DateTime DeletedAt { get; set; } = DateTime.UtcNow;

        public ChatMessage? Message { get; set; }
        public User? User { get; set; }
    }
}
