using MatchYourMatch.WebAPI.DTOs.Event;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IEventService
    {
        Task<List<EventDto>> GetByQueryAsync(int currentUserId, string? category);
        Task<EventDto> GetByIdAsync(int id, int currentUserId);
        Task<EventDto> CreateAsync(int userId, CreateEventDto dto);
        Task<EventDto> JoinAsync(int eventId, int userId);
        Task UpdateAsync(int organizerId, int eventId, CreateEventDto dto);
        Task DeleteAsync(int organizerId, int eventId);
    }
}
