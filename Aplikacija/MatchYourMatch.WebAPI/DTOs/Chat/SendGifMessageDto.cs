namespace MatchYourMatch.WebAPI.DTOs.Chat
{
    public class SendGifMessageDto
    {
        public string? Body { get; set; }
        public required string Provider { get; set; }
        public required string GifId { get; set; }
        public required string OriginalUrl { get; set; }
        public required string PreviewUrl { get; set; }
    }
}
