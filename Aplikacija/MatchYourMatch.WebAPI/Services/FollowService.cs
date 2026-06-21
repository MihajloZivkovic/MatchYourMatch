using MatchYourMatch.WebAPI.Data;
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

        public async Task<List<FollowDto>> GetFollowersAsync(int userId)
        {
            return await _context.Follows
                .Where(f => f.FollowingId == userId)
                .Select(f => new FollowDto
                {
                    Id = f.Follower!.Id,
                    Username = f.Follower.Username
                }).ToListAsync();
        }
        
        public async Task<List<FollowDto>> GetFollowingAsync(int userId)
        {
            return await _context.Follows
                .Where(f => f.FollowerId == userId)
                .Select(f => new FollowDto
                {
                    Id = f.Following!.Id,
                    Username = f.Following.Username
                }).ToListAsync();
        }

        public async Task FollowAsync(int followerId, int followingId)
        {
            if (followerId == followingId)
                throw new Exception("You cannot follow yourself.");
            var follower = await _context.Users.FindAsync(followerId)
                ?? throw new Exception("Follower does not exist.");
            if (!await _context.Users.AnyAsync(u => u.Id == followingId && u.IsActive))
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
    }
}
