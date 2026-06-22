using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Search;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class SearchController : ControllerBase
    {
        private const int CategoryLimit = 5;
        private readonly AppDbContext _context;
        private readonly ILogger<SearchController> _logger;

        public SearchController(AppDbContext context, ILogger<SearchController> logger)
        {
            _context = context;
            _logger = logger;
        }

        [HttpGet]
        public async Task<ActionResult<SearchResponseDto>> Search([FromQuery] string? query)
        {
            var trimmedQuery = query?.Trim() ?? string.Empty;
            var response = new SearchResponseDto { Query = trimmedQuery };

            if (trimmedQuery.Length < 2)
            {
                return Ok(response);
            }

            var normalizedQuery = trimmedQuery.ToLower();
            var currentUserId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

            response.People = await SearchCategory("people", () => SearchPeople(normalizedQuery, currentUserId));
            response.Events = await SearchCategory("events", () => SearchEvents(normalizedQuery));
            response.Activities = await SearchCategory("activities", () => SearchActivities(normalizedQuery));
            response.Interests = await SearchCategory("interests", () => SearchInterests(normalizedQuery));

            return Ok(response);
        }

        private async Task<List<T>> SearchCategory<T>(string category, Func<Task<List<T>>> search)
        {
            try
            {
                return await search();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Global search category {Category} could not be loaded.", category);
                return new List<T>();
            }
        }

        private async Task<List<SearchPersonDto>> SearchPeople(string query, int currentUserId)
        {
            var excluded = _context.HiddenProfiles.Where(x => x.UserId == currentUserId).Select(x => x.HiddenUserId)
                .Concat(_context.BlockedUsers.Where(x => x.BlockerUserId == currentUserId || x.BlockedUserId == currentUserId)
                    .Select(x => x.BlockerUserId == currentUserId ? x.BlockedUserId : x.BlockerUserId));
            var users = await _context.Users
                .AsNoTracking()
                .Include(u => u.Profile)
                .Include(u => u.UserInterests)
                    .ThenInclude(ui => ui.Interest)
                .Where(u => u.IsActive && u.Id != currentUserId && !excluded.Contains(u.Id))
                .ToListAsync();

            return users
                .Select(u => new { User = u, Score = ScorePerson(u, query) })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.User.Username)
                .Take(CategoryLimit)
                .Select(x => new SearchPersonDto
                {
                    Id = x.User.Id,
                    Username = x.User.Username,
                    DisplayName = x.User.Username,
                    ProfilePicture = x.User.Profile?.ProfilePicture,
                    Role = x.User.Role,
                    LocationDisplayName = GetPublicLocation(x.User.Profile),
                    Tags = x.User.UserInterests
                        .Select(ui => ui.Interest?.Name)
                        .Where(name => !string.IsNullOrWhiteSpace(name))
                        .Take(4)
                        .Cast<string>()
                        .ToList()
                })
                .ToList();
        }

        private async Task<List<SearchEventDto>> SearchEvents(string query)
        {
            var events = await _context.Events
                .AsNoTracking()
                .Include(e => e.Interest)
                .Include(e => e.Organizer)
                .ToListAsync();

            return events
                .Select(e => new { Event = e, Score = ScoreEvent(e, query) })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Event.Date)
                .ThenBy(x => x.Event.Time)
                .Take(CategoryLimit)
                .Select(x => new SearchEventDto
                {
                    Id = x.Event.Id,
                    Title = x.Event.Title,
                    Description = x.Event.Description,
                    Location = GetPublicEventLocation(x.Event),
                    DateTime = x.Event.Date.ToDateTime(x.Event.Time),
                    CategoryName = x.Event.Interest?.Name
                })
                .ToList();
        }

        private static string GetPublicEventLocation(Models.Event eventItem)
        {
            if (eventItem.ShowFullAddress) return eventItem.Location;
            var parts = new[] { eventItem.LocationCity, eventItem.LocationCountry }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase);
            var location = string.Join(", ", parts);
            return string.IsNullOrWhiteSpace(location) ? "Location not shared" : location;
        }

        private async Task<List<SearchActivityDto>> SearchActivities(string query)
        {
            var activities = await _context.Activities
                .AsNoTracking()
                .Include(a => a.ActivityCategory)
                .ToListAsync();

            return activities
                .Select(a => new { Activity = a, Score = ScoreActivity(a, query) })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Activity.DisplayName)
                .Take(CategoryLimit)
                .Select(x => new SearchActivityDto
                {
                    Id = x.Activity.Id,
                    Name = x.Activity.Name,
                    DisplayName = x.Activity.DisplayName,
                    ActivityCategoryId = x.Activity.ActivityCategoryId,
                    CategoryName = x.Activity.ActivityCategory.DisplayName
                })
                .ToList();
        }

        private async Task<List<SearchInterestDto>> SearchInterests(string query)
        {
            var interests = await _context.Interests
                .AsNoTracking()
                .Include(i => i.UserInterests)
                .ToListAsync();

            return interests
                .Select(i => new { Interest = i, Score = ScoreInterest(i, query) })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .ThenBy(x => x.Interest.Name)
                .Take(CategoryLimit)
                .Select(x => new SearchInterestDto
                {
                    Id = x.Interest.Id,
                    Name = x.Interest.Name,
                    Category = x.Interest.Category,
                    Count = x.Interest.UserInterests.Count
                })
                .ToList();
        }

        private static int ScorePerson(Models.User user, string query)
        {
            var score = 0;
            score = Math.Max(score, ScoreText(user.Username, query, 100, 80));
            score = Math.Max(score, ScoreText(user.Profile?.Bio, query, 0, 25));
            score = Math.Max(score, ScoreText(user.Profile?.LocationDisplayName, query, 0, 45));
            score = Math.Max(score, ScoreText(user.Profile?.LocationCity, query, 0, 35));
            score = Math.Max(score, ScoreText(user.Profile?.LocationCountry, query, 0, 25));

            foreach (var interest in user.UserInterests.Select(ui => ui.Interest?.Name))
            {
                score = Math.Max(score, ScoreText(interest, query, 70, 55));
            }

            return score;
        }

        private static int ScoreEvent(Models.Event eventItem, string query)
        {
            var score = 0;
            score = Math.Max(score, ScoreText(eventItem.Title, query, 100, 80));
            score = Math.Max(score, ScoreText(eventItem.Interest?.Name, query, 70, 60));
            score = Math.Max(score, ScoreText(eventItem.Location, query, 0, 45));
            score = Math.Max(score, ScoreText(eventItem.Organizer?.Username, query, 0, 40));
            score = Math.Max(score, ScoreText(eventItem.Description, query, 0, 25));
            return score;
        }

        private static int ScoreActivity(Models.Activity activity, string query)
        {
            var score = 0;
            score = Math.Max(score, ScoreText(activity.DisplayName, query, 100, 75));
            score = Math.Max(score, ScoreText(activity.Name, query, 95, 75));
            score = Math.Max(score, ScoreText(activity.ActivityCategory?.DisplayName, query, 0, 40));
            score = Math.Max(score, ScoreText(activity.ActivityCategory?.Name, query, 0, 35));
            return score;
        }

        private static int ScoreInterest(Models.Interest interest, string query)
        {
            var score = 0;
            score = Math.Max(score, ScoreText(interest.Name, query, 100, 75));
            score = Math.Max(score, ScoreText(interest.Category, query, 0, 35));
            return score;
        }

        private static int ScoreText(string? value, string query, int exactScore, int containsScore)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return 0;
            }

            var normalizedValue = value.Trim().ToLower();

            if (exactScore > 0 && normalizedValue == query)
            {
                return exactScore;
            }

            return normalizedValue.Contains(query) ? containsScore : 0;
        }

        private static string? GetPublicLocation(Models.UserProfile? profile)
        {
            if (profile is null || profile.LocationPrivacy == "Hidden")
            {
                return null;
            }

            if (!string.IsNullOrWhiteSpace(profile.LocationDisplayName))
            {
                return profile.LocationDisplayName;
            }

            var parts = new[] { profile.LocationCity, profile.LocationCountry }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .ToList();

            return parts.Count > 0 ? string.Join(", ", parts) : null;
        }
    }
}
