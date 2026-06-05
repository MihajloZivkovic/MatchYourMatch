using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Match;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class QuickMatchService : IQuickMatchService
    {
        private readonly AppDbContext _context;

        public QuickMatchService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<QuickMatchPostDto> CreatePostAsync(
            int userId,
            CreateQuickMatchRequestDto request)
        {
            if (request.StartTime >= request.EndTime)
                throw new Exception("Vreme početka mora biti pre vremena završetka.");

            if (string.IsNullOrWhiteSpace(request.Activity))
                throw new Exception("Aktivnost je obavezna.");

            var post = new QuickMatchPost
            {
                UserId = userId,
                Date = DateOnly.FromDateTime(DateTime.Now),
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                Activity = request.Activity.Trim(),
                Description = request.Description,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.QuickMatchPosts.Add(post);
            await _context.SaveChangesAsync();

            var savedPost = await _context.QuickMatchPosts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .FirstAsync(p => p.Id == post.Id);

            return MapToDto(savedPost, 0);
        }

        public async Task<List<QuickMatchPostDto>> GetMatchesAsync(
            int userId,
            CreateQuickMatchRequestDto request)
        {
            if (request.StartTime >= request.EndTime)
                throw new Exception("Vreme početka mora biti pre vremena završetka.");

            if (string.IsNullOrWhiteSpace(request.Activity))
                throw new Exception("Aktivnost je obavezna.");

            var today = DateOnly.FromDateTime(DateTime.Now);
            var activity = request.Activity.Trim().ToLower();

            var posts = await _context.QuickMatchPosts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .Where(p =>
                    p.UserId != userId &&
                    p.Date == today &&
                    p.IsActive &&
                    p.Activity.ToLower() == activity)
                .ToListAsync();

            var matches = posts
                .Select(post =>
                {
                    var overlapMinutes = CalculateOverlapMinutes(
                        request.StartTime,
                        request.EndTime,
                        post.StartTime,
                        post.EndTime
                    );

                    return new
                    {
                        Post = post,
                        OverlapMinutes = overlapMinutes
                    };
                })
                .Where(x => x.OverlapMinutes > 0)
                .OrderByDescending(x => x.OverlapMinutes)
                .Select(x => MapToDto(x.Post, x.OverlapMinutes))
                .ToList();

            return matches;
        }

        public async Task<List<QuickMatchPostDto>> GetTodayPostsAsync(int userId)
        {
            var today = DateOnly.FromDateTime(DateTime.Now);

            var posts = await _context.QuickMatchPosts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .Where(p =>
                    p.UserId != userId &&
                    p.Date == today &&
                    p.IsActive)
                .OrderBy(p => p.StartTime)
                .ToListAsync();

            return posts
                .Select(post => MapToDto(post, 0))
                .ToList();
        }

        private int CalculateOverlapMinutes(
            TimeOnly requestStart,
            TimeOnly requestEnd,
            TimeOnly postStart,
            TimeOnly postEnd)
        {
            var overlapStart = requestStart > postStart ? requestStart : postStart;
            var overlapEnd = requestEnd < postEnd ? requestEnd : postEnd;

            if (overlapStart >= overlapEnd)
                return 0;

            return (int)(overlapEnd.ToTimeSpan() - overlapStart.ToTimeSpan()).TotalMinutes;
        }

        private QuickMatchPostDto MapToDto(
            QuickMatchPost post,
            int overlapMinutes)
        {
            return new QuickMatchPostDto
            {
                Id = post.Id,
                UserId = post.UserId,
                Username = post.User.Username,
                Location = post.User.Profile?.Location,
                Activity = post.Activity,
                Description = post.Description,
                StartTime = post.StartTime.ToString("HH:mm"),
                EndTime = post.EndTime.ToString("HH:mm"),
                OverlapMinutes = overlapMinutes,
                MatchScore = overlapMinutes,
                Reason = overlapMinutes > 0
                    ? $"Poklapate se {overlapMinutes} minuta za aktivnost: {post.Activity}"
                    : $"Oglas za aktivnost: {post.Activity}"
            };
        }
    }
}