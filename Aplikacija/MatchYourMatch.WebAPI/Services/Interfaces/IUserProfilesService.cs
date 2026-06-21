using MatchYourMatch.WebAPI.DTOs.User;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IUserProfilesService
    {
        Task<UserProfileDto> GetProfileAsync(int userId);
        Task<PublicUserProfileDto> GetPublicProfileAsync(int userId, int currentUserId);
        Task<List<UserMatchDto>> GetMatchesAsync(int userId);
        Task<UserProfileDto> EditProfileAsync(int userId, EditProfileDto dto);
        Task<UserProfileDto> UpdateProfileTagsAsync(int userId, UpdateProfileTagsDto dto);
        Task<List<FreeTimeSlotDto>> GetTimeSlotsAsync(int userId);
        Task AddTimeSlotAsync(int userId, CreateFreeTimeSlotDto dto);
        Task RemoveTimeSlotAsync(int userId, int timeslotId);
        Task<List<FreeTimeSlotDto>> UpdateAvailabilityAsync(int userId, UpdateAvailabilityDto dto);
        Task<DeepMatchPreferenceDto> GetDeepMatchPreferenceAsync(int userId);
        Task<DeepMatchPreferenceDto> UpdateDeepMatchPreferenceAsync(int userId, DeepMatchPreferenceDto dto);
        Task<List<InterestDto>> GetInterestsAsync();
        Task<List<InterestDto>> GetUserInterestsAsync(int userId);
        Task AddInterestAsync(int userId, int interestId);
        Task RemoveInterestAsync(int userId, int interestId);
    }
}
