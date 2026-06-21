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
        private readonly IChatService _chatService;
        private readonly INotificationService _notifications;

        private const int PointsPerOverlapMinute = 2;
        private const int ExactActivityBonus = 150;
        private const int SameCategoryActivityBonus = 70;
        private const int SameLocationBonus = 80;

        public QuickMatchService(AppDbContext context, IChatService chatService, INotificationService notifications)
        {
            _context = context;
            _chatService = chatService;
            _notifications = notifications;
        }

        public async Task<DTOs.Chat.ChatConversationDto> ConnectAsync(int userId, int postId)
        {
            var post = await _context.QuickMatchPosts
                .Include(p => p.User)
                .FirstOrDefaultAsync(p => p.Id == postId && p.IsActive)
                ?? throw new KeyNotFoundException("Quick Match is no longer available.");
            if (post.UserId == userId)
                throw new InvalidOperationException("You cannot match with yourself.");
            var actorName = await _context.Users.Where(u => u.Id == userId).Select(u => u.Username).FirstAsync();
            var conversation = await _chatService.StartConversationAsync(userId, post.UserId);
            var userAId = Math.Min(userId, post.UserId);
            var userBId = Math.Max(userId, post.UserId);
            var match = await _context.UserMatches.FirstOrDefaultAsync(value =>
                value.UserAId == userAId && value.UserBId == userBId && value.Source == "QuickMatch");
            if (match == null)
            {
                _context.UserMatches.Add(new UserMatch
                {
                    UserAId = userAId,
                    UserBId = userBId,
                    Source = "QuickMatch",
                    IsActive = true
                });
            }
            else
            {
                match.IsActive = true;
            }
            await _context.SaveChangesAsync();
            await _notifications.CreateNotificationAsync(post.UserId, userId, "QuickMatch",
                "New Quick Match", $"You matched with {actorName}.",
                "User", userId, true);
            return conversation;
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
                .Include(u => u.AppSettings)
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
                .Include(p => p.User)
                    .ThenInclude(u => u.AppSettings)
                .Include(p => p.Activity)
                    .ThenInclude(a => a.ActivityCategory)
                .Where(p =>
                    p.UserId != userId &&
                    p.Date == today &&
                    p.IsActive)
                .ToListAsync();

            posts = posts.Where(post => IsEligibleBySettings(currentUser, post.User, true)).ToList();

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
                .Include(p => p.User)
                    .ThenInclude(u => u.AppSettings)
                .Include(p => p.Activity)
                    .ThenInclude(a => a.ActivityCategory)
                .Where(p =>
                    p.UserId != userId &&
                    (p.User.AppSettings == null || p.User.AppSettings.ShowMeInQuickMatch) &&
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

            var locationScore = currentUser.AppSettings?.PreferPeopleNearby == false ? 0 : CalculateLocationScore(
                currentUser.Profile, postUser.Profile);

            var ageScore = 0;
            var currentAge = CalculateAge(currentUser.Profile?.DateOfBirth);
            var candidateAge = CalculateAge(postUser.Profile?.DateOfBirth);
            if (currentAge.HasValue && candidateAge.HasValue)
            {
                var difference = Math.Abs(currentAge.Value - candidateAge.Value);
                ageScore = difference <= 2 ? 60 : difference <= 5 ? 35 : difference <= 10 ? 15 : 0;
            }

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
                ProfilePicture = post.User.Profile?.ProfilePicture,
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

        private static bool IsEligibleBySettings(User current, User candidate, bool quick)
        {
            if (quick && candidate.AppSettings?.ShowMeInQuickMatch == false) return false;
            var age = CalculateAge(candidate.Profile?.DateOfBirth);
            if (current.AppSettings?.MinAge is int min && (!age.HasValue || age < min)) return false;
            if (current.AppSettings?.MaxAge is int max && (!age.HasValue || age > max)) return false;
            if (current.AppSettings?.MaximumDistanceKm is int maximum &&
                current.Profile?.Latitude is double lat1 && current.Profile.Longitude is double lon1 &&
                candidate.Profile?.Latitude is double lat2 && candidate.Profile.Longitude is double lon2 &&
                CalculateDistanceKm(lat1, lon1, lat2, lon2) > maximum) return false;
            return true;
        }

        private static double CalculateDistanceKm(double lat1, double lon1, double lat2, double lon2)
        {
            const double radius = 6371;
            var dLat = (lat2 - lat1) * Math.PI / 180;
            var dLon = (lon2 - lon1) * Math.PI / 180;
            var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) + Math.Cos(lat1 * Math.PI / 180) *
                Math.Cos(lat2 * Math.PI / 180) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            return radius * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        }

        private static int? CalculateAge(DateOnly? dob)
        {
            if (!dob.HasValue) return null;
            var today = DateOnly.FromDateTime(DateTime.Today);
            var age = today.Year - dob.Value.Year;
            if (dob.Value > today.AddYears(-age)) age--;
            return age;
        }
    }
}
