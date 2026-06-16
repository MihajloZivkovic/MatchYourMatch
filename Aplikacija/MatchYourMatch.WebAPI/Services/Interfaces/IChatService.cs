using MatchYourMatch.WebAPI.DTOs.Chat;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IChatService
    {
        Task<List<ChatConversationDto>> GetConversationsAsync(int userId);
        Task<List<ChatMessageDto>> GetMessagesAsync(int userId, int conversationId);
        Task<ChatConversationDto> StartConversationAsync(int userId, int otherUserId);
        Task<ChatMessageDto> SendMessageAsync(int userId, SendChatMessageDto request);
        Task<ChatMessageDto> UpdateMessageAsync(int userId, int messageId, UpdateChatMessageDto request);
        Task MarkConversationReadAsync(int userId, int conversationId);
        Task HideConversationAsync(int userId, int conversationId);
        Task DeleteMessageForUserAsync(int userId, int messageId);
        Task<ChatMessageDto> DeleteMessageForEveryoneAsync(int userId, int messageId);
        Task SetTypingAsync(int userId, int conversationId, bool isTyping);
        Task<bool> IsOtherUserTypingAsync(int userId, int conversationId);
    }
}
