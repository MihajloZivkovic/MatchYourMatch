namespace MatchYourMatch.WebAPI.Models
{
    public class MessageAttachment
    {
        public int Id { get; set; }
        public int? ChatMessageId { get; set; }
        public int? EventDiscussionMessageId { get; set; }
        public required string Kind { get; set; }
        public string? OriginalFileName { get; set; }
        public string? StoredFileName { get; set; }
        public string? ContentType { get; set; }
        public long Size { get; set; }
        public string? StoragePath { get; set; }
        public byte[]? Content { get; set; }
        public string? Provider { get; set; }
        public string? ProviderMediaId { get; set; }
        public string? OriginalUrl { get; set; }
        public string? PreviewUrl { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ChatMessage? ChatMessage { get; set; }
        public EventDiscussionMessage? EventDiscussionMessage { get; set; }
    }
}
