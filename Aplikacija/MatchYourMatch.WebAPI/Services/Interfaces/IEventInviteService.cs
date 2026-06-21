using MatchYourMatch.WebAPI.DTOs.Event;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IEventInviteService
    {
        Task<EventInviteDto> CreateAsync(int eventId, int inviterUserId, int inviteeUserId);
        Task<List<EventInviteCandidateDto>> SearchCandidatesAsync(int eventId, int inviterUserId, string? query);
        Task<List<EventInviteDto>> GetPendingForUserAsync(int userId);
        Task<EventInviteDto> AcceptAsync(int inviteId, int userId);
        Task<EventInviteDto> DeclineAsync(int inviteId, int userId);
    }
}
