using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Rating;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class UserRatingService : IUserRatingService
    {
        private const string RegularRatingEligibilityReason = "You can rate this user after matching through Quick Match or attending a past event together.";
        private const string OrganizerRatingEligibilityReason = "You can rate this organizer after attending one of their events.";
        private readonly AppDbContext _context;
        public UserRatingService(AppDbContext context) => _context = context;

        public async Task<UserRatingStatusDto> GetStatusAsync(int raterUserId, int ratedUserId)
        {
            var ratedRole = await EnsureUsersAsync(raterUserId, ratedUserId);
            var isOrganizerRating = IsOrganizer(ratedRole);
            var matched = !isOrganizerRating && await AreUsersMatchedAsync(raterUserId, ratedUserId);
            var eligibleEvents = isOrganizerRating
                ? await GetEligibleOrganizerEventsAsync(raterUserId, ratedUserId)
                : await GetEligibleEventsAsync(raterUserId, ratedUserId);
            var myRating = await _context.UserRatings.AsNoTracking()
                .Include(r => r.Event)
                .Where(r => r.RaterUserId == raterUserId && r.RatedUserId == ratedUserId)
                .OrderByDescending(r => r.UpdatedAt ?? r.CreatedAt)
                .ThenByDescending(r => r.Id)
                .FirstOrDefaultAsync();
            var received = _context.UserRatings.AsNoTracking().Where(r => r.RatedUserId == ratedUserId);
            var ratingsCount = await received.CountAsync();
            var average = ratingsCount == 0 ? (decimal?)null : await received.AverageAsync(r => r.Rating);

            var eventDtos = eligibleEvents
                .OrderByDescending(e => e.Date.ToDateTime(e.Time))
                .Select(e => new EligibleRatingEventDto
                {
                    EventId = e.Id,
                    Title = e.Title,
                    DateTime = e.Date.ToDateTime(e.Time),
                    MyRating = myRating?.Rating
                }).ToList();
            var isEligible = matched || eventDtos.Count > 0;
            var myRatingDto = myRating == null ? null : ToDto(myRating);
            var canRate = isEligible && myRating == null;

            return new UserRatingStatusDto
            {
                CanRate = canRate,
                HasRated = myRating != null,
                Reason = !isEligible
                    ? isOrganizerRating ? OrganizerRatingEligibilityReason : RegularRatingEligibilityReason
                    : myRating != null ? isOrganizerRating ? "You have already rated this organizer. Use edit instead." : "You have already rated this user. Use edit instead." : null,
                AverageRating = average.HasValue ? decimal.Round(average.Value, 1) : null,
                RatingsCount = ratingsCount,
                MyRating = myRatingDto,
                MyRatings = myRatingDto == null ? new List<UserRatingItemDto>() : new List<UserRatingItemDto> { myRatingDto },
                EligibleEvents = eventDtos
            };
        }

        public async Task<UserRatingStatusDto> SaveAsync(int raterUserId, int ratedUserId, SaveUserRatingDto dto)
        {
            ValidateRating(dto.Rating);
            var ratedRole = await EnsureUsersAsync(raterUserId, ratedUserId);
            var isOrganizerRating = IsOrganizer(ratedRole);
            var matched = !isOrganizerRating && await AreUsersMatchedAsync(raterUserId, ratedUserId);
            var eligibleEvents = isOrganizerRating
                ? await GetEligibleOrganizerEventsAsync(raterUserId, ratedUserId)
                : await GetEligibleEventsAsync(raterUserId, ratedUserId);
            var eligibleEvent = dto.EventId.HasValue
                ? eligibleEvents.FirstOrDefault(e => e.Id == dto.EventId.Value)
                : eligibleEvents.OrderByDescending(e => e.Date.ToDateTime(e.Time)).FirstOrDefault();
            if (!matched && eligibleEvent == null)
                throw new UnauthorizedAccessException(
                    isOrganizerRating
                        ? OrganizerRatingEligibilityReason
                        : "Users must have an active Quick Match match or have attended a past event together.");

            var existing = await _context.UserRatings.FirstOrDefaultAsync(r =>
                r.RaterUserId == raterUserId && r.RatedUserId == ratedUserId);
            if (existing != null)
                throw new InvalidOperationException("You have already rated this user. Use edit instead.");

            _context.UserRatings.Add(new UserRating
            {
                RaterUserId = raterUserId,
                RatedUserId = ratedUserId,
                EventId = eligibleEvent?.Id,
                Rating = dto.Rating
            });
            await _context.SaveChangesAsync();
            return await GetStatusAsync(raterUserId, ratedUserId);
        }

        public async Task<UserRatingStatusDto> UpdateAsync(int raterUserId, int ratedUserId, UpdateUserRatingDto dto)
        {
            ValidateRating(dto.Score);
            var ratedRole = await EnsureUsersAsync(raterUserId, ratedUserId);
            if (IsOrganizer(ratedRole) && !(await GetEligibleOrganizerEventsAsync(raterUserId, ratedUserId)).Any())
                throw new UnauthorizedAccessException(OrganizerRatingEligibilityReason);
            var rating = await _context.UserRatings.FirstOrDefaultAsync(value =>
                    value.RaterUserId == raterUserId && value.RatedUserId == ratedUserId)
                ?? throw new KeyNotFoundException("You have not rated this user yet.");

            rating.Rating = dto.Score;
            rating.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return await GetStatusAsync(raterUserId, ratedUserId);
        }

        private async Task<string> EnsureUsersAsync(int raterUserId, int ratedUserId)
        {
            if (raterUserId == ratedUserId)
                throw new InvalidOperationException("You cannot rate yourself.");
            var ratedRole = await _context.Users
                .Where(u => u.Id == ratedUserId && u.IsActive)
                .Select(u => u.Role)
                .FirstOrDefaultAsync();
            if (ratedRole == null)
                throw new KeyNotFoundException("User does not exist.");
            if (IsAdmin(ratedRole))
                throw new UnauthorizedAccessException("Admin profiles cannot be rated.");
            return ratedRole;
        }

        private Task<bool> AreUsersMatchedAsync(int currentUserId, int otherUserId)
        {
            var userAId = Math.Min(currentUserId, otherUserId);
            var userBId = Math.Max(currentUserId, otherUserId);
            return _context.UserMatches.AsNoTracking().AnyAsync(match =>
                match.UserAId == userAId && match.UserBId == userBId &&
                match.Source == "QuickMatch" && match.IsActive);
        }

        private async Task<List<Event>> GetEligibleEventsAsync(int firstUserId, int secondUserId)
        {
            var events = await _context.EventParticipants.AsNoTracking()
                .Where(p => p.UserId == firstUserId &&
                    _context.EventParticipants.Any(other => other.EventId == p.EventId && other.UserId == secondUserId))
                .Select(p => p.Event)
                .ToListAsync();
            var now = DateTime.Now;
            return events.Where(e => e.Date.ToDateTime(e.Time) < now).ToList();
        }

        private async Task<List<Event>> GetEligibleOrganizerEventsAsync(int raterUserId, int organizerId)
        {
            var now = DateTime.Now;
            var today = DateOnly.FromDateTime(now);
            var currentTime = TimeOnly.FromDateTime(now);
            return await _context.Events.AsNoTracking()
                .Where(e => e.OrganizerId == organizerId &&
                    (e.Date < today || (e.Date == today && e.Time < currentTime)) &&
                    e.Participants.Any(p => p.UserId == raterUserId))
                .ToListAsync();
        }

        private static bool IsOrganizer(string role) =>
            string.Equals(role, "Organizer", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "EventOrganizer", StringComparison.OrdinalIgnoreCase);

        private static bool IsAdmin(string role) =>
            string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Administrator", StringComparison.OrdinalIgnoreCase);

        private static void ValidateRating(decimal rating)
        {
            if (rating < 0 || rating > 5 || rating * 2 != decimal.Truncate(rating * 2))
                throw new InvalidOperationException("Rating must be between 0 and 5 in steps of 0.5.");
        }

        private static UserRatingItemDto ToDto(UserRating rating) => new()
        {
            Id = rating.Id,
            Rating = rating.Rating,
            EncounterType = "Profile",
            EventId = rating.EventId,
            EncounterTitle = null,
            EncounterAt = null,
            CreatedAt = rating.CreatedAt,
            UpdatedAt = rating.UpdatedAt
        };
    }
}
