using System.Security.Claims;
using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Common;
using MatchYourMatch.WebAPI.DTOs.Event;
using MatchYourMatch.WebAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/organizers")]
    [Authorize]
    public class OrganizersController : ControllerBase
    {
        private readonly AppDbContext _context;

        public OrganizersController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet("{id:int}/events")]
        public async Task<IActionResult> GetEvents(int id, [FromQuery] string? status = "upcoming",
            [FromQuery] int page = 1, [FromQuery] int pageSize = 6)
        {
            var currentUserId = TryCurrentUserId();
            if (!await IsPublicOrganizerAsync(id))
                return NotFound("Organizer profile was not found.");

            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize <= 0 ? 6 : pageSize, 1, 20);
            var now = DateTime.Now;
            var today = DateOnly.FromDateTime(now);
            var currentTime = TimeOnly.FromDateTime(now);
            var normalizedStatus = string.Equals(status, "past", StringComparison.OrdinalIgnoreCase) ? "past" : "upcoming";

            var query = _context.Events
                .AsNoTracking()
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.SavedByUsers)
                .Include(e => e.JoinRequests)
                .Include(e => e.Participants).ThenInclude(p => p.User).ThenInclude(u => u.Profile)
                .Where(e => e.OrganizerId == id);

            query = normalizedStatus == "past"
                ? query.Where(e => e.Date < today || (e.Date == today && e.Time < currentTime))
                : query.Where(e => e.Date > today || (e.Date == today && e.Time >= currentTime));

            var totalCount = await query.CountAsync();
            query = normalizedStatus == "past"
                ? query.OrderByDescending(e => e.Date).ThenByDescending(e => e.Time)
                : query.OrderBy(e => e.Date).ThenBy(e => e.Time);

            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            return Ok(new PagedResultDto<EventDto>
            {
                Items = items.Select(e => ToDto(e, currentUserId)).ToList(),
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }

        [HttpGet("{id:int}/subscription")]
        public async Task<IActionResult> GetSubscription(int id)
        {
            var currentUserId = TryCurrentUserId();
            if (!await IsPublicOrganizerAsync(id))
                return NotFound("Organizer profile was not found.");
            if (currentUserId == 0)
                return Ok(new { subscribed = false });

            var subscribed = await _context.OrganizerSubscriptions
                .AnyAsync(s => s.UserId == currentUserId && s.OrganizerId == id);
            return Ok(new { subscribed });
        }

        [HttpPost("{id:int}/subscription")]
        public async Task<IActionResult> Subscribe(int id)
        {
            var currentUserId = CurrentUserId();
            var currentRole = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role");
            if (!string.Equals(currentRole, "User", StringComparison.OrdinalIgnoreCase))
                return StatusCode(StatusCodes.Status403Forbidden, "Only regular users can subscribe to organizer events.");
            if (currentUserId == id)
                return BadRequest("You cannot subscribe to yourself.");
            if (!await IsPublicOrganizerAsync(id))
                return NotFound("Organizer profile was not found.");
            if (!await _context.OrganizerSubscriptions.AnyAsync(s => s.UserId == currentUserId && s.OrganizerId == id))
            {
                _context.OrganizerSubscriptions.Add(new OrganizerSubscription { UserId = currentUserId, OrganizerId = id });
                await _context.SaveChangesAsync();
            }
            return Ok(new { subscribed = true });
        }

        [HttpDelete("{id:int}/subscription")]
        public async Task<IActionResult> Unsubscribe(int id)
        {
            var currentUserId = CurrentUserId();
            await _context.OrganizerSubscriptions
                .Where(s => s.UserId == currentUserId && s.OrganizerId == id)
                .ExecuteDeleteAsync();
            return Ok(new { subscribed = false });
        }

        private async Task<bool> IsPublicOrganizerAsync(int id)
        {
            return await _context.Users.AsNoTracking().AnyAsync(u =>
                u.Id == id && u.IsActive && !u.IsDeactivated && u.Role == "Organizer");
        }

        private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        private int TryCurrentUserId() => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var userId) ? userId : 0;

        private static EventDto ToDto(Event e, int currentUserId)
        {
            var participants = e.Participants.OrderBy(p => p.JoinedAt).ToList();
            return new EventDto
            {
                Id = e.Id,
                Title = e.Title,
                Category = e.Interest?.Name,
                Date = e.Date,
                Time = e.Time,
                Location = e.ShowFullAddress ? e.Location : GetPublicLocation(e),
                ShowFullAddress = e.ShowFullAddress,
                MaxAttendees = e.MaxAttendees,
                MinAge = e.MinAge,
                MaxAge = e.MaxAge,
                RequiresParticipantApproval = e.RequiresParticipantApproval,
                Description = e.Description,
                ImageUrl = e.ImageUrl,
                CreatedByUserId = e.OrganizerId,
                OrganizerUsername = e.Organizer?.Username,
                ParticipantsCount = participants.Count,
                ParticipantInitials = participants.Take(4).Select(p => GetInitials(p.User?.Username)).ToList(),
                ParticipantAvatars = participants.Where(p => p.User != null).Take(4).Select(p => new EventParticipantAvatarDto
                {
                    UserId = p.UserId,
                    Username = p.User!.Username,
                    Initials = GetInitials(p.User.Username),
                    ProfilePicture = p.User.Profile?.ProfilePicture
                }).ToList(),
                IsJoinedByCurrentUser = participants.Any(p => p.UserId == currentUserId),
                IsOrganizer = e.OrganizerId == currentUserId,
                IsCreator = e.OrganizerId == currentUserId,
                JoinRequestStatus = e.JoinRequests.Where(r => r.UserId == currentUserId).Select(r => r.Status).FirstOrDefault(),
                PendingJoinRequestsCount = e.OrganizerId == currentUserId ? e.JoinRequests.Count(r => r.Status == "Pending") : 0,
                IsSaved = e.SavedByUsers.Any(saved => saved.UserId == currentUserId)
            };
        }

        private static string GetPublicLocation(Event e)
        {
            var parts = new[] { e.LocationCity, e.LocationCountry }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase);
            var publicLocation = string.Join(", ", parts);
            return string.IsNullOrWhiteSpace(publicLocation) ? "Location not shared" : publicLocation;
        }

        private static string GetInitials(string? username)
        {
            if (string.IsNullOrWhiteSpace(username)) return "MY";
            var initials = string.Join("", username.Split(new[] { '.', '_', '-', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Take(2).Select(part => char.ToUpperInvariant(part[0]).ToString()));
            return string.IsNullOrWhiteSpace(initials) ? "MY" : initials;
        }
    }
}
