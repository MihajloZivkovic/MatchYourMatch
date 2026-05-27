using MatchYourMatch.WebAPI.DTOs.User;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IUserProfilesService
    {
        Task<UserProfileDto> GetProfileAsync(int userId);
        Task EditProfileAsync(int userId, EditProfileDto dto);
        Task<List<FreeTimeSlotDto>> GetTimeSlotsAsync(int userId);
        Task AddTimeSlotAsync(int userId, CreateFreeTimeSlotDto dto);
    }
}
