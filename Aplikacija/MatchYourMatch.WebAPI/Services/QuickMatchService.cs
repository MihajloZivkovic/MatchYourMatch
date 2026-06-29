using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Match;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Data;

namespace MatchYourMatch.WebAPI.Services
{
    public class QuickMatchService : IQuickMatchService
    {
        private readonly AppDbContext _context;
        private readonly IChatService _chatService;
        private readonly INotificationService _notifications;
        private readonly IQuickMatchExpirationService _expiration;

        private const int PointsPerOverlapMinute = 2;
        private const int ExactActivityBonus = 150;
        private const int SameCategoryActivityBonus = 70;
        private const int SameLocationBonus = 80;

        public QuickMatchService(AppDbContext context, IChatService chatService, INotificationService notifications,
            IQuickMatchExpirationService expiration)
        {
            _context = context;
            _chatService = chatService;
            _notifications = notifications;
            _expiration = expiration;
        }

        public async Task<QuickMatchRequestDto> SendRequestAsync(int userId, int postId)
        {
            await _expiration.ExpireDuePostsAsync();
            var post = await _context.QuickMatchPosts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .FirstOrDefaultAsync(p => p.Id == postId)
                ?? throw new KeyNotFoundException("This Quick Match post is no longer available.");
            if (!post.IsActive || post.EndsAtUtc <= DateTime.UtcNow)
                throw new InvalidOperationException("This Quick Match post is no longer available.");
            if (post.UserId == userId)
                throw new InvalidOperationException("You cannot match with yourself.");
            if (!post.User.IsActive || post.User.IsDeactivated || post.User.Profile?.ProfileVisibility == "Private" || await IsExcludedAsync(userId, post.UserId))
                throw new InvalidOperationException("This Quick Match post is no longer available.");
            var requester = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId && u.IsActive && !u.IsDeactivated)
                ?? throw new UnauthorizedAccessException("Your account cannot use Quick Match.");
            if (!IsWithinAge(CalculateAge(requester.Profile?.DateOfBirth), post.PreferredMinAge, post.PreferredMaxAge))
                throw new InvalidOperationException("This Quick Match post is no longer available.");
            if (await _context.QuickMatchRequests.AnyAsync(r => r.QuickMatchPostId == postId && r.RequesterUserId == userId))
                throw new InvalidOperationException("A request has already been sent for this Quick Match post.");

            var request = new QuickMatchRequest { QuickMatchPostId = postId, RequesterUserId = userId };
            _context.QuickMatchRequests.Add(request);
            try { await _context.SaveChangesAsync(); }
            catch (DbUpdateException) { throw new InvalidOperationException("A request has already been sent for this Quick Match post."); }
            await _notifications.CreateNotificationAsync(post.UserId, userId, "QuickMatchRequest",
                "Quick Match request", $"{requester.Username} wants to match with your Quick Match post.",
                "QuickMatchRequest", request.Id, true);
            return MapRequest(request, requester);
        }

        public async Task<QuickMatchRequestDto> AcceptRequestAsync(int userId, int requestId)
        {
            await _expiration.ExpireDuePostsAsync();
            await using var transaction = await _context.Database.BeginTransactionAsync(IsolationLevel.Serializable);
            var request = await _context.QuickMatchRequests.Include(r => r.QuickMatchPost)
                .Include(r => r.RequesterUser).ThenInclude(u => u.Profile)
                .FirstOrDefaultAsync(r => r.Id == requestId)
                ?? throw new KeyNotFoundException("Quick Match request was not found.");
            if (request.QuickMatchPost.UserId != userId)
                throw new UnauthorizedAccessException("Only the post owner can accept this request.");
            if (request.Status != QuickMatchRequestStatuses.Pending)
                throw new InvalidOperationException($"This request is already {request.Status.ToLowerInvariant()}.");
            if (!request.QuickMatchPost.IsActive || request.QuickMatchPost.EndsAtUtc <= DateTime.UtcNow)
                throw new InvalidOperationException("This Quick Match post is no longer available.");
            if (!request.RequesterUser.IsActive || request.RequesterUser.IsDeactivated || await IsExcludedAsync(userId, request.RequesterUserId))
                throw new InvalidOperationException("This requester is no longer available.");

            var now = DateTime.UtcNow;
            request.Status = QuickMatchRequestStatuses.Accepted;
            request.RespondedAt = now;
            request.QuickMatchPost.IsActive = false;
            await _context.QuickMatchRequests
                .Where(r => r.QuickMatchPostId == request.QuickMatchPostId && r.Id != request.Id && r.Status == QuickMatchRequestStatuses.Pending)
                .ExecuteUpdateAsync(s => s.SetProperty(r => r.Status, QuickMatchRequestStatuses.Expired).SetProperty(r => r.RespondedAt, now));

            var userAId = Math.Min(userId, request.RequesterUserId);
            var userBId = Math.Max(userId, request.RequesterUserId);
            var match = await _context.UserMatches.FirstOrDefaultAsync(m => m.UserAId == userAId && m.UserBId == userBId && m.Source == "QuickMatch");
            if (match == null) _context.UserMatches.Add(new UserMatch { UserAId = userAId, UserBId = userBId, Source = "QuickMatch", IsActive = true });
            else match.IsActive = true;
            await _context.SaveChangesAsync();
            await _chatService.StartConversationAsync(userId, request.RequesterUserId);
            await _notifications.CreateNotificationAsync(request.RequesterUserId, userId, "QuickMatch",
                "Quick Match accepted", "Your Quick Match request was accepted.", "User", userId, true);
            await transaction.CommitAsync();
            return MapRequest(request, request.RequesterUser);
        }

        public async Task<QuickMatchRequestDto> RejectRequestAsync(int userId, int requestId)
        {
            await _expiration.ExpireDuePostsAsync();
            var request = await _context.QuickMatchRequests.Include(r => r.QuickMatchPost)
                .Include(r => r.RequesterUser).ThenInclude(u => u.Profile).FirstOrDefaultAsync(r => r.Id == requestId)
                ?? throw new KeyNotFoundException("Quick Match request was not found.");
            if (request.QuickMatchPost.UserId != userId)
                throw new UnauthorizedAccessException("Only the post owner can decline this request.");
            if (request.Status != QuickMatchRequestStatuses.Pending)
                throw new InvalidOperationException($"This request is already {request.Status.ToLowerInvariant()}.");
            if (!request.QuickMatchPost.IsActive || request.QuickMatchPost.EndsAtUtc <= DateTime.UtcNow)
                throw new InvalidOperationException("This Quick Match post is no longer available.");
            request.Status = QuickMatchRequestStatuses.Rejected;
            request.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return MapRequest(request, request.RequesterUser);
        }

        public async Task<QuickMatchPostDto> CreatePostAsync(
            int userId,
            CreateQuickMatchRequestDto request)
        {
            ValidateRequest(request);
            await _expiration.ExpireDuePostsAsync(userId);

            var activityExists = await _context.Activities
                .AnyAsync(a => a.Id == request.ActivityId);

            if (!activityExists)
                throw new Exception("Activity does not exist.");

            if (await _context.QuickMatchPosts.AnyAsync(p => p.UserId == userId && p.IsActive && p.EndsAtUtc > DateTime.UtcNow))
                throw new InvalidOperationException("You already have an active Quick Match post. Update or delete it first.");

            var post = new QuickMatchPost
            {
                UserId = userId,
                Date = DateOnly.FromDateTime(NormalizeUtc(request.StartsAtUtc)),
                StartTime = request.StartTime,
                EndTime = request.EndTime,
                StartsAtUtc = NormalizeUtc(request.StartsAtUtc),
                EndsAtUtc = NormalizeUtc(request.EndsAtUtc),
                ActivityId = request.ActivityId,
                Description = request.Description,
                PreferredMinAge = request.PreferredMinAge,
                PreferredMaxAge = request.PreferredMaxAge,
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

        public async Task<QuickMatchPostDto?> GetActivePostAsync(int userId)
        {
            await _expiration.ExpireDuePostsAsync(userId);
            var post = await PostWithDetails()
                .Where(p => p.UserId == userId && p.IsActive && p.EndsAtUtc > DateTime.UtcNow)
                .OrderByDescending(p => p.CreatedAt)
                .FirstOrDefaultAsync();
            return post == null ? null : MapToDto(post, 0);
        }

        public async Task<QuickMatchPostDto> UpdatePostAsync(int userId, int postId, CreateQuickMatchRequestDto request)
        {
            ValidateRequest(request);
            await _expiration.ExpireDuePostsAsync(userId);
            if (!await _context.Activities.AnyAsync(a => a.Id == request.ActivityId))
                throw new Exception("Activity does not exist.");

            var post = await _context.QuickMatchPosts.FirstOrDefaultAsync(p => p.Id == postId && p.IsActive)
                ?? throw new KeyNotFoundException("Quick Match post was not found.");
            if (post.UserId != userId) throw new UnauthorizedAccessException("You can only update your own Quick Match post.");

            post.StartTime = request.StartTime;
            post.EndTime = request.EndTime;
            post.StartsAtUtc = NormalizeUtc(request.StartsAtUtc);
            post.EndsAtUtc = NormalizeUtc(request.EndsAtUtc);
            post.Date = DateOnly.FromDateTime(post.StartsAtUtc);
            post.ExpiredAt = null;
            post.ActivityId = request.ActivityId;
            post.Description = request.Description?.Trim();
            post.PreferredMinAge = request.PreferredMinAge;
            post.PreferredMaxAge = request.PreferredMaxAge;
            await _context.SaveChangesAsync();

            var savedPost = await PostWithDetails().FirstAsync(p => p.Id == post.Id);
            return MapToDto(savedPost, 0);
        }

        public async Task DeletePostAsync(int userId, int postId)
        {
            await _expiration.ExpireDuePostsAsync(userId);
            var post = await _context.QuickMatchPosts.FirstOrDefaultAsync(p => p.Id == postId && p.IsActive)
                ?? throw new KeyNotFoundException("Quick Match post was not found.");
            if (post.UserId != userId) throw new UnauthorizedAccessException("You can only delete your own Quick Match post.");
            post.IsActive = false;
            await _context.QuickMatchRequests
                .Where(r => r.QuickMatchPostId == postId && r.Status == QuickMatchRequestStatuses.Pending)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(r => r.Status, QuickMatchRequestStatuses.Expired)
                    .SetProperty(r => r.RespondedAt, DateTime.UtcNow));
            await _context.SaveChangesAsync();
        }

        private IQueryable<QuickMatchPost> PostWithDetails() => _context.QuickMatchPosts
            .Include(p => p.User).ThenInclude(u => u.Profile)
            .Include(p => p.Activity).ThenInclude(a => a.ActivityCategory);

        public async Task<List<QuickMatchPostDto>> GetMatchesAsync(
            int userId,
            QuickMatchSearchRequestDto request)
        {
            ValidateRequest(request);
            await _expiration.ExpireDuePostsAsync();

            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .Include(u => u.AppSettings)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser == null || !currentUser.IsActive || currentUser.IsDeactivated)
                throw new UnauthorizedAccessException("Your account cannot use Quick Match.");

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
                    p.User.IsActive && !p.User.IsDeactivated &&
                    (p.User.Profile == null || p.User.Profile.ProfileVisibility != "Private") &&
                    p.IsActive && p.EndsAtUtc > DateTime.UtcNow)
                .ToListAsync();

            var excludedIds = await GetExcludedUserIdsAsync(userId);
            posts = posts.Where(post => !excludedIds.Contains(post.UserId)
                && IsEligibleBySettings(currentUser, post.User, true)
                && IsWithinAge(CalculateAge(currentUser.Profile?.DateOfBirth), post.PreferredMinAge, post.PreferredMaxAge)
                && IsWithinAge(CalculateAge(post.User.Profile?.DateOfBirth), request.MinAge, request.MaxAge)).ToList();
            var previouslyRequestedPostIds = await _context.QuickMatchRequests
                .Where(r => r.RequesterUserId == userId).Select(r => r.QuickMatchPostId).ToListAsync();
            posts = posts.Where(post => !previouslyRequestedPostIds.Contains(post.Id)).ToList();

            var matches = posts
                .Select(post =>
                {
                    var overlapMinutes = CalculateOverlapMinutes(
                        NormalizeUtc(request.StartsAtUtc),
                        NormalizeUtc(request.EndsAtUtc),
                        post.StartsAtUtc,
                        post.EndsAtUtc
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
            await _expiration.ExpireDuePostsAsync();

            var posts = await _context.QuickMatchPosts
                .Include(p => p.User)
                    .ThenInclude(u => u.Profile)
                .Include(p => p.User)
                    .ThenInclude(u => u.AppSettings)
                .Include(p => p.Activity)
                    .ThenInclude(a => a.ActivityCategory)
                .Where(p =>
                    p.UserId != userId &&
                    p.User.IsActive && !p.User.IsDeactivated &&
                    (p.User.Profile == null || p.User.Profile.ProfileVisibility != "Private") &&
                    (p.User.AppSettings == null || p.User.AppSettings.ShowMeInQuickMatch) &&
                    p.IsActive && p.EndsAtUtc > DateTime.UtcNow)
                .OrderBy(p => p.StartTime)
                .ToListAsync();

            var excludedIds = await GetExcludedUserIdsAsync(userId);
            var viewerAge = await _context.UserProfiles.Where(p => p.UserId == userId).Select(p => p.DateOfBirth).FirstOrDefaultAsync();
            var requestedPostIds = await _context.QuickMatchRequests.Where(r => r.RequesterUserId == userId)
                .Select(r => r.QuickMatchPostId).ToListAsync();
            posts = posts.Where(post => !excludedIds.Contains(post.UserId) && !requestedPostIds.Contains(post.Id)
                && IsWithinAge(CalculateAge(viewerAge), post.PreferredMinAge, post.PreferredMaxAge)).ToList();

            return posts
                .Select(post => MapToDto(
                    post: post,
                    overlapMinutes: 0
                ))
                .ToList();
        }

        private void ValidateRequest(CreateQuickMatchRequestDto request)
        {
            if (NormalizeUtc(request.StartsAtUtc) == default || NormalizeUtc(request.EndsAtUtc) <= NormalizeUtc(request.StartsAtUtc))
                throw new Exception("The start time must be before the end time.");
            if (NormalizeUtc(request.EndsAtUtc) <= DateTime.UtcNow)
                throw new InvalidOperationException("The end time must be in the future.");

            if (request.ActivityId <= 0)
                throw new Exception("Activity is required.");
            ValidateAgeRange(request.PreferredMinAge, request.PreferredMaxAge);
        }

        private void ValidateRequest(QuickMatchSearchRequestDto request)
        {
            if (NormalizeUtc(request.StartsAtUtc) == default || NormalizeUtc(request.EndsAtUtc) <= NormalizeUtc(request.StartsAtUtc))
                throw new InvalidOperationException("The start time must be before the end time.");
            if (request.ActivityId <= 0)
                throw new InvalidOperationException("Activity is required.");
            ValidateAgeRange(request.MinAge, request.MaxAge);
        }

        private int CalculateOverlapMinutes(
            DateTime requestStart,
            DateTime requestEnd,
            DateTime postStart,
            DateTime postEnd)
        {
            var overlapStart = requestStart > postStart ? requestStart : postStart;
            var overlapEnd = requestEnd < postEnd ? requestEnd : postEnd;

            if (overlapStart >= overlapEnd)
                return 0;

            return (int)(overlapEnd - overlapStart).TotalMinutes;
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
                StartsAtUtc = post.StartsAtUtc,
                EndsAtUtc = post.EndsAtUtc,

                OverlapMinutes = overlapMinutes
                ,PreferredMinAge = post.PreferredMinAge
                ,PreferredMaxAge = post.PreferredMaxAge
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
            if (candidate.Profile?.ProfileVisibility == "Private") return false;
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

        private async Task<List<int>> GetExcludedUserIdsAsync(int userId) => await _context.BlockedUsers
            .Where(x => x.BlockerUserId == userId || x.BlockedUserId == userId)
            .Select(x => x.BlockerUserId == userId ? x.BlockedUserId : x.BlockerUserId)
            .Concat(_context.HiddenProfiles.Where(x => x.UserId == userId).Select(x => x.HiddenUserId))
            .Distinct().ToListAsync();

        private async Task<bool> IsExcludedAsync(int firstUserId, int secondUserId) =>
            await _context.BlockedUsers.AnyAsync(x =>
                (x.BlockerUserId == firstUserId && x.BlockedUserId == secondUserId) ||
                (x.BlockerUserId == secondUserId && x.BlockedUserId == firstUserId)) ||
            await _context.HiddenProfiles.AnyAsync(x =>
                (x.UserId == firstUserId && x.HiddenUserId == secondUserId) ||
                (x.UserId == secondUserId && x.HiddenUserId == firstUserId));

        private static void ValidateAgeRange(int? minAge, int? maxAge)
        {
            const int minimumAllowedAge = 16;
            const int maximumAllowedAge = 120;
            if (minAge is < minimumAllowedAge or > maximumAllowedAge || maxAge is < minimumAllowedAge or > maximumAllowedAge ||
                (minAge.HasValue && maxAge.HasValue && minAge > maxAge))
                throw new InvalidOperationException("Invalid age range.");
        }

        private static bool IsWithinAge(int? age, int? minAge, int? maxAge)
        {
            if (!minAge.HasValue && !maxAge.HasValue) return true;
            return age.HasValue && (!minAge.HasValue || age >= minAge) && (!maxAge.HasValue || age <= maxAge);
        }

        private static QuickMatchRequestDto MapRequest(QuickMatchRequest request, User requester) => new()
        {
            Id = request.Id,
            QuickMatchPostId = request.QuickMatchPostId,
            RequesterUserId = request.RequesterUserId,
            RequesterDisplayName = requester.Profile?.FullName ?? requester.Username,
            RequesterAvatar = requester.Profile?.ProfilePicture,
            Status = request.Status,
            CreatedAt = request.CreatedAt,
            RespondedAt = request.RespondedAt
        };

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

        private static DateTime NormalizeUtc(DateTime value) => value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}
