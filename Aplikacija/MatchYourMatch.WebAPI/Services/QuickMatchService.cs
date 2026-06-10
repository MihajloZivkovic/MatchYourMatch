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

        private const int PointsPerOverlapMinute = 2;
        private const int ExactActivityBonus = 150;
        private const int SameCategoryActivityBonus = 70;
        private const int SameLocationBonus = 80;

        public QuickMatchService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<QuickMatchPostDto> CreatePostAsync(
            int userId,
            CreateQuickMatchRequestDto request)
        {
            ValidateRequest(request);

            var activityExists = await _context.Activities
                .AnyAsync(a => a.Id == request.ActivityId);

            if (!activityExists)
                throw new Exception("Activity does not exist.");

            var post = new QuickMatchPost
            {
                UserId = userId,
                Date = DateOnly.FromDateTime(DateTime.Now),
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                ActivityId = request.ActivityId,
                Description = request.Description,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.QuickMatchPosts.Add(post);
            await _context.SaveChangesAsync();

            var savedPost = await _context.QuickMatchPosts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .Include(p => p.Activity)
                    .ThenInclude(a => a.ActivityCategory)
                .FirstAsync(p => p.Id == post.Id);

            return MapToDto(
                post: savedPost,
                overlapMinutes: 0
            );
        }

        public async Task<List<QuickMatchPostDto>> GetMatchesAsync(
            int userId,
            CreateQuickMatchRequestDto request)
        {
            ValidateRequest(request);

            var today = DateOnly.FromDateTime(DateTime.Now);

            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser == null)
                throw new Exception("User does not exist.");

            var requestedActivity = await _context.Activities
                .Include(a => a.ActivityCategory)
                .FirstOrDefaultAsync(a => a.Id == request.ActivityId);

            if (requestedActivity == null)
                throw new Exception("Chosen activity does not exist.");

            var posts = await _context.QuickMatchPosts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .Include(p => p.Activity)
                    .ThenInclude(a => a.ActivityCategory)
                .Where(p =>
                    p.UserId != userId &&
                    p.Date == today &&
                    p.IsActive)
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

                    if (overlapMinutes <= 0)
                        return null;

                    var matchScore = CalculateMatchScore(
                        overlapMinutes,
                        requestedActivity,
                        post.Activity,
                        currentUser,
                        post.User
                    );

                    var dto = MapToDto(
                        post: post,
                        overlapMinutes: overlapMinutes
                    );

                    return new
                    {
                        Dto = dto,
                        MatchScore = matchScore,
                        OverlapMinutes = overlapMinutes
                    };
                })
                .Where(match => match != null)
                .OrderByDescending(match => match!.MatchScore)
                .ThenByDescending(match => match!.OverlapMinutes)
                .Select(match => match!.Dto)
                .ToList();

            return matches;
        }

        public async Task<List<QuickMatchPostDto>> GetTodayPostsAsync(int userId)
        {
            var today = DateOnly.FromDateTime(DateTime.Now);

            var posts = await _context.QuickMatchPosts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .Include(p => p.Activity)
                    .ThenInclude(a => a.ActivityCategory)
                .Where(p =>
                    p.UserId != userId &&
                    p.Date == today &&
                    p.IsActive)
                .OrderBy(p => p.StartTime)
                .ToListAsync();

            return posts
                .Select(post => MapToDto(
                    post: post,
                    overlapMinutes: 0
                ))
                .ToList();
        }

        private void ValidateRequest(CreateQuickMatchRequestDto request)
        {
            if (request.StartTime >= request.EndTime)
                throw new Exception("The start time must be before the end time.");

            if (request.ActivityId <= 0)
                throw new Exception("Activity is required.");
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

        private int CalculateMatchScore(
            int overlapMinutes,
            Activity requestedActivity,
            Activity postActivity,
            User currentUser,
            User postUser)
        {
            var timeScore = overlapMinutes * PointsPerOverlapMinute;

            var activityScore = CalculateActivityScore(
                requestedActivity,
                postActivity
            );

            var locationScore = CalculateLocationScore(
                currentUser.Profile,
                postUser.Profile
            );

            var ageScore = 0;

            return timeScore + activityScore + locationScore + ageScore;
        }

        private int CalculateActivityScore(
            Activity requestedActivity,
            Activity postActivity)
        {
            if (requestedActivity.Id == postActivity.Id)
                return ExactActivityBonus;

            if (requestedActivity.ActivityCategoryId == postActivity.ActivityCategoryId)
                return SameCategoryActivityBonus;

            return 0;
        }

        private int CalculateLocationScore(
            UserProfile? currentUserProfile,
            UserProfile? postUserProfile)
        {
            if (currentUserProfile == null || postUserProfile == null)
                return 0;

            if (!string.IsNullOrWhiteSpace(currentUserProfile.LocationCity) &&
                !string.IsNullOrWhiteSpace(postUserProfile.LocationCity) &&
                NormalizeText(currentUserProfile.LocationCity) == NormalizeText(postUserProfile.LocationCity))
            {
                return SameLocationBonus;
            }

            if (!string.IsNullOrWhiteSpace(currentUserProfile.LocationCountry) &&
                !string.IsNullOrWhiteSpace(postUserProfile.LocationCountry) &&
                NormalizeText(currentUserProfile.LocationCountry) == NormalizeText(postUserProfile.LocationCountry))
            {
                return SameLocationBonus / 4;
            }

            return 0;
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
                Location = GetPublicLocation(post.User.Profile),

                ActivityId = post.ActivityId,
                ActivityName = post.Activity.DisplayName,
                ActivityCategoryId = post.Activity.ActivityCategoryId,
                ActivityCategoryName = post.Activity.ActivityCategory.DisplayName,

                Description = post.Description,
                StartTime = post.StartTime.ToString("HH:mm"),
                EndTime = post.EndTime.ToString("HH:mm"),

                OverlapMinutes = overlapMinutes
            };
        }

        private string NormalizeText(string text)
        {
            return text
                .Trim()
                .ToLower()
                .Replace("š", "s")
                .Replace("đ", "dj")
                .Replace("č", "c")
                .Replace("ć", "c")
                .Replace("ž", "z");
        }

        private static string? GetPublicLocation(UserProfile? profile)
        {
            if (profile == null)
                return null;

            if (profile.LocationPrivacy == "Hidden")
                return "Location hidden";

            if (!string.IsNullOrWhiteSpace(profile.LocationDisplayName))
                return profile.LocationDisplayName;

            var parts = new[] { profile.LocationCity, profile.LocationCountry }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .ToList();

            return parts.Count > 0 ? string.Join(", ", parts) : null;
        }
    }
}
