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

        public FollowService(AppDbContext context)
        {
            _context = context;
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
            var exists = await _context.Follows.AnyAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);
            if (exists)
                throw new Exception("Korisnik je vec zapracen.");
            _context.Follows.Add(new Follow
            {
                FollowerId = followerId,
                FollowingId = followingId
            });
            await _context.SaveChangesAsync();
        }

        public async Task UnfollowAsync(int followerId, int followingId)
        {
            var exists = await _context.Follows
                .FirstOrDefaultAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);
            if (exists == null)
                throw new Exception("Korisnik nije zapracen.");
            _context.Follows.Remove(exists);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> IsFollowingAsync(int followerId, int followingId)
        {
            return await _context.Follows.AnyAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);
        }
    }
}
