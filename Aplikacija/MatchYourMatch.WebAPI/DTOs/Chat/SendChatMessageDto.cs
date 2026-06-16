namespace MatchYourMatch.WebAPI.DTOs.Chat
{
    public class SendChatMessageDto
    {
        public int ConversationId { get; set; }
        public required string Body { get; set; }
    }
}
