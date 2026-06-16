namespace MatchYourMatch.WebAPI.DTOs.Chat
{
    public class ChatConversationDto
    {
        public int ConversationId { get; set; }
        public int OtherUserId { get; set; }
        public required string OtherUsername { get; set; }
        public string? OtherDisplayName { get; set; }
        public string? OtherInitials { get; set; }
        public string? OtherAvatar { get; set; }
        public string? LastMessagePreview { get; set; }
        public int UnreadCount { get; set; }
        public DateTime? LastMessageAt { get; set; }
    }
}
