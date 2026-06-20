using MatchYourMatch.WebAPI.DTOs.Event;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IEventService
    {
        Task<List<EventDto>> GetByQueryAsync(int currentUserId, string? category, bool includePast = false);
        Task<ProfileEventsDto> GetProfileEventsAsync(int currentUserId);
        Task<EventDto> GetByIdAsync(int id, int currentUserId);
        Task<EventDto> CreateAsync(int userId, CreateEventDto dto);
        Task<EventDto> JoinAsync(int eventId, int userId);
        Task<List<EventDiscussionMessageDto>> GetDiscussionAsync(int eventId, int userId);
        Task<EventDiscussionMessageDto> AddDiscussionMessageAsync(int eventId, int userId, CreateEventDiscussionMessageDto dto);
        Task UpdateAsync(int organizerId, int eventId, CreateEventDto dto);
        Task DeleteAsync(int organizerId, int eventId);
    }
}
