using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Rating;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class UserRatingService : IUserRatingService
    {
        private readonly AppDbContext _context;
        public UserRatingService(AppDbContext context) => _context = context;

        public async Task<UserRatingStatusDto> GetStatusAsync(int raterUserId, int ratedUserId)
        {
            await EnsureUsersAsync(raterUserId, ratedUserId);
            var matched = await AreUsersMatchedAsync(raterUserId, ratedUserId);
            var eligibleEvents = await GetEligibleEventsAsync(raterUserId, ratedUserId);
            var myRatings = await _context.UserRatings.AsNoTracking()
                .Where(r => r.RaterUserId == raterUserId && r.RatedUserId == ratedUserId)
                .ToListAsync();
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
                    MyRating = myRatings.FirstOrDefault(rating => rating.EventId == e.Id)?.Rating
                }).ToList();

            return new UserRatingStatusDto
            {
                CanRate = matched || eventDtos.Count > 0,
                Reason = !matched && eventDtos.Count == 0
                    ? "You can rate this user after matching through Quick Match or attending a past event together."
                    : null,
                AverageRating = average.HasValue ? decimal.Round(average.Value, 1) : null,
                RatingsCount = ratingsCount,
                MyRating = eventDtos.FirstOrDefault()?.MyRating ??
                    myRatings.FirstOrDefault(rating => rating.EventId == null)?.Rating,
                EligibleEvents = eventDtos
            };
        }

        public async Task<UserRatingStatusDto> SaveAsync(int raterUserId, int ratedUserId, SaveUserRatingDto dto)
        {
            ValidateRating(dto.Rating);
            await EnsureUsersAsync(raterUserId, ratedUserId);
            var matched = await AreUsersMatchedAsync(raterUserId, ratedUserId);
            var eligibleEvents = await GetEligibleEventsAsync(raterUserId, ratedUserId);
            var selectedEventIsEligible = dto.EventId.HasValue &&
                eligibleEvents.Any(e => e.Id == dto.EventId.Value);
            if (!matched && !selectedEventIsEligible)
                throw new UnauthorizedAccessException(
                    "Users must have an active Quick Match match or have attended a past event together.");

            var ratingEventId = selectedEventIsEligible ? dto.EventId : null;

            var existing = await _context.UserRatings.FirstOrDefaultAsync(r =>
                r.RaterUserId == raterUserId && r.RatedUserId == ratedUserId && r.EventId == ratingEventId);
            if (existing == null)
            {
                _context.UserRatings.Add(new UserRating
                {
                    RaterUserId = raterUserId,
                    RatedUserId = ratedUserId,
                    EventId = ratingEventId,
                    Rating = dto.Rating
                });
            }
            else
            {
                existing.Rating = dto.Rating;
                existing.UpdatedAt = DateTime.UtcNow;
            }
            await _context.SaveChangesAsync();
            return await GetStatusAsync(raterUserId, ratedUserId);
        }

        private async Task EnsureUsersAsync(int raterUserId, int ratedUserId)
        {
            if (raterUserId == ratedUserId)
                throw new InvalidOperationException("You cannot rate yourself.");
            if (!await _context.Users.AnyAsync(u => u.Id == ratedUserId && u.IsActive))
                throw new KeyNotFoundException("User does not exist.");
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

        private static void ValidateRating(decimal rating)
        {
            if (rating < 0 || rating > 5 || rating * 2 != decimal.Truncate(rating * 2))
                throw new InvalidOperationException("Rating must be between 0 and 5 in steps of 0.5.");
        }
    }
}
