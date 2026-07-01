using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Common;
using MatchYourMatch.WebAPI.DTOs.User;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class FollowService: IFollowService
    {
        private readonly AppDbContext _context;
        private readonly INotificationService _notifications;

        public FollowService(AppDbContext context, INotificationService notifications)
        {
            _context = context;
            _notifications = notifications;
        }

        public Task<PagedResultDto<FollowDto>> GetFollowersAsync(int userId, int currentUserId, int page, int pageSize)
        {
            var users = _context.Follows
                .Where(f => f.FollowingId == userId)
                .Select(f => f.Follower!);
            return GetFollowUsersPageAsync(users, currentUserId, page, pageSize);
        }
        
        public Task<PagedResultDto<FollowDto>> GetFollowingAsync(int userId, int currentUserId, int page, int pageSize)
        {
            var users = _context.Follows
                .Where(f => f.FollowerId == userId)
                .Select(f => f.Following!);
            return GetFollowUsersPageAsync(users, currentUserId, page, pageSize);
        }

        public async Task FollowAsync(int followerId, int followingId)
        {
            if (followerId == followingId)
                throw new Exception("You cannot follow yourself.");

            var follower = await _context.Users.FindAsync(followerId)
                ?? throw new Exception("Follower does not exist.");

            if (string.Equals(follower.Role, "Organizer", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(follower.Role, "Admin", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Organizer and admin accounts cannot follow users.");

            var target = await _context.Users.FirstOrDefaultAsync(u => u.Id == followingId && u.IsActive)
                ?? throw new Exception("User does not exist.");

            if (string.Equals(target.Role, "Admin", StringComparison.OrdinalIgnoreCase))
                throw new Exception("User does not exist.");

            var exists = await _context.Follows.AnyAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);
            if (exists)
                return;

            _context.Follows.Add(new Follow
            {
                FollowerId = followerId,
                FollowingId = followingId
            });
            await _context.SaveChangesAsync();
            await _notifications.CreateNotificationAsync(followingId, followerId, "Follow",
                "New follower", $"{follower.Username} started following you.",
                "User", followerId, true);
        }

        public async Task UnfollowAsync(int followerId, int followingId)
        {
            var exists = await _context.Follows
                .FirstOrDefaultAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);
            if (exists == null)
                return;
            _context.Follows.Remove(exists);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> IsFollowingAsync(int followerId, int followingId)
        {
            return await _context.Follows.AnyAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);
        }

        private async Task<PagedResultDto<FollowDto>> GetFollowUsersPageAsync(
            IQueryable<User> users,
            int currentUserId,
            int page,
            int pageSize)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize <= 0 ? 20 : pageSize, 1, 50);

            var excluded = _context.HiddenProfiles
                .Where(x => x.UserId == currentUserId)
                .Select(x => x.HiddenUserId)
                .Concat(_context.BlockedUsers
                    .Where(x => x.BlockerUserId == currentUserId || x.BlockedUserId == currentUserId)
                    .Select(x => x.BlockerUserId == currentUserId ? x.BlockedUserId : x.BlockerUserId));

            var filtered = users
                .AsNoTracking()
                .Where(user => user.IsActive && !user.IsDeactivated && !excluded.Contains(user.Id) &&
                    user.Role != "Admin" && user.Role != "Administrator");

            var totalCount = await filtered.CountAsync();
            var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);
            var pageUsers = await filtered
                .OrderBy(user => user.Username)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            var pageUserIds = pageUsers.Select(user => user.Id).ToList();
            var profiles = await _context.UserProfiles.AsNoTracking()
                .Where(profile => pageUserIds.Contains(profile.UserId))
                .ToDictionaryAsync(profile => profile.UserId);

            var followingIds = await _context.Follows.AsNoTracking()
                .Where(follow => follow.FollowerId == currentUserId && pageUserIds.Contains(follow.FollowingId))
                .Select(follow => follow.FollowingId)
                .ToListAsync();
                
            var followingSet = followingIds.ToHashSet();
            var items = pageUsers
                .Select(user =>
                {
                    profiles.TryGetValue(user.Id, out var profile);
                    return new FollowDto
                    {
                        Id = user.Id,
                        UserId = user.Id,
                        Username = user.Username,
                        DisplayName = profile != null && profile.ShowFullName && profile.FullName != null
                            ? profile.FullName : user.Username,
                        ProfilePictureUrl = profile != null ? profile.ProfilePicture : null,
                        Location = GetPublicLocation(profile),
                        IsFollowing = user.Id != currentUserId && followingSet.Contains(user.Id)
                    };
                })
                .ToList();

            return new PagedResultDto<FollowDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalPages
            };
        }

        private static string? GetPublicLocation(UserProfile? profile)
        {
            if (profile == null) 
                return null;
            if (profile.LocationPrivacy == "Hidden") 
                return null;
            if (profile.LocationPrivacy == "CityOnly")
            {
                var parts = new[] { profile.LocationCity, profile.LocationCountry }
                    .Where(value => !string.IsNullOrWhiteSpace(value))
                    .Select(value => value!.Trim())
                    .Distinct(StringComparer.OrdinalIgnoreCase);
                var location = string.Join(", ", parts);
                return string.IsNullOrWhiteSpace(location) ? null : location;
            }
            return profile.LocationDisplayName ?? profile.Location;
        }
    }
}
