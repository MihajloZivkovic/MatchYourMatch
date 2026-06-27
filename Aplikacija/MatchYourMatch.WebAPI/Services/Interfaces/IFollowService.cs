using MatchYourMatch.WebAPI.DTOs.Common;
using MatchYourMatch.WebAPI.DTOs.User;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IFollowService
    {
        Task<PagedResultDto<FollowDto>> GetFollowersAsync(int userId, int currentUserId, int page, int pageSize);
        Task<PagedResultDto<FollowDto>> GetFollowingAsync(int userId, int currentUserId, int page, int pageSize);
        Task FollowAsync(int followerId, int followingId);
        Task UnfollowAsync(int followerId, int followingId);
        Task<bool> IsFollowingAsync(int followerId, int followingId);
    }
}
