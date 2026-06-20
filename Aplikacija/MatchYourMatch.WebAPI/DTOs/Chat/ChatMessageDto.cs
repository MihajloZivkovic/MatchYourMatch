namespace MatchYourMatch.WebAPI.DTOs.Chat
{
    public class ChatMessageDto
    {
        public int Id { get; set; }
        public int ConversationId { get; set; }
        public int SenderId { get; set; }
        public int? ReceiverId { get; set; }
        public string? SenderUsername { get; set; }
        public string? SenderDisplayName { get; set; }
        public string? SenderInitials { get; set; }
        public required string Body { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReadAt { get; set; }
        public DateTime? EditedAt { get; set; }
        public bool IsDeletedForEveryone { get; set; }
        public DateTime? DeletedAt { get; set; }
        public bool IsMine { get; set; }
        public List<ChatMessageReactionDto> Reactions { get; set; } = new();
        public string? CurrentUserReaction { get; set; }
    }

    public class ChatMessageReactionDto
    {
        public required string Emoji { get; set; }
        public int Count { get; set; }
        public bool ReactedByCurrentUser { get; set; }
    }
}
