using MatchYourMatch.WebAPI.DTOs.Chat;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IChatService
    {
        Task<List<ChatConversationDto>> GetConversationsAsync(int userId);
        Task<List<ChatMessageDto>> GetMessagesAsync(int userId, int conversationId);
        Task<ChatConversationDto> StartConversationAsync(int userId, int otherUserId);
        Task<ChatConversationDto> CreateGroupConversationAsync(int userId, CreateGroupChatRequestDto request);
        Task<GroupChatSettingsDto> GetGroupSettingsAsync(int userId, int conversationId);
        Task<GroupChatSettingsDto> UpdateGroupAsync(int userId, int conversationId, UpdateGroupChatDto request);
        Task<GroupChatSettingsDto> SetGroupMuteAsync(int userId, int conversationId, UpdateGroupMuteDto request);
        Task RemoveGroupMemberAsync(int userId, int conversationId, int memberUserId);
        Task LeaveGroupAsync(int userId, int conversationId);
        Task DeleteGroupAsync(int userId, int conversationId);
        Task<ChatMessageDto> SendMessageAsync(int userId, SendChatMessageDto request);
        Task<ChatMessageDto> SendAttachmentAsync(int userId, int conversationId, string? body, IFormFile file, CancellationToken cancellationToken = default);
        Task<ChatMessageDto> SendGifAsync(int userId, int conversationId, SendGifMessageDto request);
        Task<(Stream Stream, string ContentType, string FileName)> DownloadAttachmentAsync(int userId, int attachmentId, CancellationToken cancellationToken = default);
        Task<ChatMessageDto> UpdateMessageAsync(int userId, int messageId, UpdateChatMessageDto request);
        Task MarkConversationReadAsync(int userId, int conversationId);
        Task HideConversationAsync(int userId, int conversationId);
        Task DeleteMessageForUserAsync(int userId, int messageId);
        Task<ChatMessageDto> DeleteMessageForEveryoneAsync(int userId, int messageId);
        Task<ChatMessageDto> ToggleReactionAsync(int userId, int messageId, ToggleChatMessageReactionDto request);
        Task<ChatMessageDto> RemoveReactionAsync(int userId, int messageId);
        Task SetTypingAsync(int userId, int conversationId, bool isTyping);
        Task<bool> IsOtherUserTypingAsync(int userId, int conversationId);
    }
}
