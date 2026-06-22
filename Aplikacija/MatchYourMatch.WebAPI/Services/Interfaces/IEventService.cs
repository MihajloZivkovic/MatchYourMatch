using MatchYourMatch.WebAPI.DTOs.Event;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IEventService
    {
        Task<List<EventDto>> GetByQueryAsync(int currentUserId, string? category, bool includePast = false);
        Task<ProfileEventsDto> GetProfileEventsAsync(int currentUserId);
        Task<List<EventDto>> GetSavedEventsAsync(int currentUserId);
        Task<EventDto> SaveEventAsync(int eventId, int currentUserId);
        Task UnsaveEventAsync(int eventId, int currentUserId);
        Task<EventDto> GetByIdAsync(int id, int currentUserId);
        Task<CreateEventDto> GetForEditAsync(int id, int organizerId);
        Task<EventDto> CreateAsync(int userId, CreateEventDto dto);
        Task<EventDto> JoinAsync(int eventId, int userId);
        Task<EventDto> CancelJoinRequestAsync(int eventId, int userId);
        Task<List<EventJoinRequestDto>> GetJoinRequestsAsync(int eventId, int organizerId);
        Task<EventDto> RespondToJoinRequestAsync(int eventId, int requestId, int organizerId, bool accept);
        Task<List<EventDiscussionMessageDto>> GetDiscussionAsync(int eventId, int userId);
        Task<EventDiscussionMessageDto> AddDiscussionMessageAsync(int eventId, int userId, CreateEventDiscussionMessageDto dto);
        Task<EventDiscussionMessageDto> AddDiscussionAttachmentAsync(int eventId, int userId, string? body, IFormFile file, CancellationToken cancellationToken = default);
        Task<EventDiscussionMessageDto> AddDiscussionGifAsync(int eventId, int userId, DTOs.Chat.SendGifMessageDto dto);
        Task<(Stream Stream, string ContentType, string FileName)> DownloadDiscussionAttachmentAsync(int eventId, int userId, int attachmentId, CancellationToken cancellationToken = default);
        Task UpdateAsync(int organizerId, int eventId, CreateEventDto dto);
        Task DeleteAsync(int organizerId, int eventId);
    }
}
