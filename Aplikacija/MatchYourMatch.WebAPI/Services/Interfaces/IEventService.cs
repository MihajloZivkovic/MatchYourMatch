using MatchYourMatch.WebAPI.DTOs.Event;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IEventService
    {
        Task<List<EventDto>> GetByQueryAsync(string? category);
        Task<EventDto> GetByIdAsync(int id);
        Task<EventDto> CreateAsync(int organizerId, CreateEventDto dto);
        Task UpdateAsync(int organizerId, int eventId, CreateEventDto dto);
        Task DeleteAsync(int organizerId, int eventId);
    }
}
