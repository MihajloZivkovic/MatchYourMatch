using MatchYourMatch.WebAPI.DTOs.User;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IFollowService
    {
        Task<List<FollowDto>> GetFollowersAsync(int userId);
        Task<List<FollowDto>> GetFollowingAsync(int userId);
        Task FollowAsync(int followerId, int followingId);
        Task UnfollowAsync(int followerId, int followingId);
        Task<bool> IsFollowingAsync(int followerId, int followingId);
    }
}