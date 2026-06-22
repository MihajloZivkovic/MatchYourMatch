namespace MatchYourMatch.WebAPI.DTOs.Chat
{
    public class MessageAttachmentDto
    {
        public int Id { get; set; }
        public required string Kind { get; set; }
        public string? OriginalFileName { get; set; }
        public string? ContentType { get; set; }
        public long Size { get; set; }
        public bool IsImage { get; set; }
        public string? DownloadUrl { get; set; }
        public string? Provider { get; set; }
        public string? ProviderMediaId { get; set; }
        public string? OriginalUrl { get; set; }
        public string? PreviewUrl { get; set; }
    }
}
