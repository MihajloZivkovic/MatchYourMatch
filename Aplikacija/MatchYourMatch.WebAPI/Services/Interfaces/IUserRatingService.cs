using MatchYourMatch.WebAPI.DTOs.Rating;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IUserRatingService
    {
        Task<UserRatingStatusDto> GetStatusAsync(int raterUserId, int ratedUserId);
        Task<UserRatingStatusDto> SaveAsync(int raterUserId, int ratedUserId, SaveUserRatingDto dto);
        Task<UserRatingStatusDto> UpdateAsync(int raterUserId, int ratingId, UpdateUserRatingDto dto);
    }
}
