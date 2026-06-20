namespace MatchYourMatch.WebAPI.DTOs.Chat
{
    public class ChatConversationDto
    {
        public int ConversationId { get; set; }
        public bool IsGroup { get; set; }
        public bool IsEventThread { get; set; }
        public int? EventId { get; set; }
        public string? GroupName { get; set; }
        public string? GroupPhoto { get; set; }
        public required string DisplayName { get; set; }
        public int MemberCount { get; set; }
        public List<string> MemberInitials { get; set; } = new();
        public bool IsHidden { get; set; }
        public int? OtherUserId { get; set; }
        public string? OtherUsername { get; set; }
        public string? OtherDisplayName { get; set; }
        public string? OtherInitials { get; set; }
        public string? OtherAvatar { get; set; }
        public string? LastMessagePreview { get; set; }
        public int UnreadCount { get; set; }
        public DateTime? LastMessageAt { get; set; }
    }
}
