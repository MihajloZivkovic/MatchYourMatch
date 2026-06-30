using MatchYourMatch.WebAPI.DTOs.Admin;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IAdminService
    {
        Task<List<CheckUserDto>> GetUserInfoAsync();
        Task DeactivateUserAsync(int userId);
        Task ActivateUserAsync(int userId);
        Task DeleteUserAsync(int userId);
        Task DeleteEventAsync(int eventId);
        Task DemoteToUserAsync(int userId);
        Task PromoteToAdminAsync(int userId);
    }
}
