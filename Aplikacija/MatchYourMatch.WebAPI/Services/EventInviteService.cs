using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Event;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class EventInviteService : IEventInviteService
    {
        private readonly AppDbContext _context;
        private readonly INotificationService _notifications;

        public EventInviteService(AppDbContext context, INotificationService notifications)
        {
            _context = context;
            _notifications = notifications;
        }

        public async Task<EventInviteDto> CreateAsync(int eventId, int inviterUserId, int inviteeUserId)
        {
            if (inviterUserId == inviteeUserId)
                throw new InvalidOperationException("You cannot invite yourself.");

            var eventItem = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId)
                ?? throw new KeyNotFoundException("Event does not exist.");
            var inviter = await _context.Users.FirstOrDefaultAsync(u => u.Id == inviterUserId && u.IsActive)
                ?? throw new KeyNotFoundException("Inviter does not exist.");
            if (!string.Equals(inviter.Role, "User", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Only ordinary users can invite people.");
            if (!await _context.EventParticipants.AnyAsync(p => p.EventId == eventId && p.UserId == inviterUserId))
                throw new UnauthorizedAccessException("Join the event before inviting people.");
            var invitee = await _context.Users.FirstOrDefaultAsync(u => u.Id == inviteeUserId && u.IsActive)
                ?? throw new KeyNotFoundException("User does not exist.");
            if (await _context.EventParticipants.AnyAsync(p => p.EventId == eventId && p.UserId == inviteeUserId))
                throw new InvalidOperationException("This user already joined the event.");
            var inviteSetting = await _context.UserAppSettings.Where(x => x.UserId == inviteeUserId)
                .Select(x => x.AllowEventInvitesFrom).FirstOrDefaultAsync() ?? "PeopleIFollow";
            var allowed = inviteSetting == "Everyone" ||
                (inviteSetting == "PeopleIFollow" && await _context.Follows.AnyAsync(f => f.FollowerId == inviteeUserId && f.FollowingId == inviterUserId)) ||
                (inviteSetting == "MatchesOnly" && await _context.UserMatches.AnyAsync(m => m.IsActive && m.Source == "QuickMatch" &&
                    ((m.UserAId == inviterUserId && m.UserBId == inviteeUserId) || (m.UserBId == inviterUserId && m.UserAId == inviteeUserId))));
            if (!allowed) throw new UnauthorizedAccessException("This user does not accept event invites from you.");
            if (await _context.EventInvites.AnyAsync(i => i.EventId == eventId &&
                i.InviteeUserId == inviteeUserId && i.Status == "Pending"))
                throw new InvalidOperationException("This user already has a pending invitation.");

            var invite = new EventInvite
            {
                EventId = eventId,
                InviterUserId = inviterUserId,
                InviteeUserId = invitee.Id
            };
            await using var transaction = await _context.Database.BeginTransactionAsync();
            _context.EventInvites.Add(invite);
            await _context.SaveChangesAsync();

            await _notifications.CreateNotificationAsync(invitee.Id, inviterUserId, "EventInvite",
                "Event invitation", $"{inviter.Username} invited you to {eventItem.Title}.",
                "Event", eventId, true);
            await transaction.CommitAsync();

            return Map(invite, eventItem.Title, inviter.Username);
        }

        public async Task<List<EventInviteCandidateDto>> SearchCandidatesAsync(int eventId, int inviterUserId, string? query)
        {
            if (!await _context.Events.AnyAsync(e => e.Id == eventId))
                throw new KeyNotFoundException("Event does not exist.");
            var inviterRole = await _context.Users
                .Where(u => u.Id == inviterUserId && u.IsActive)
                .Select(u => u.Role)
                .FirstOrDefaultAsync() ?? throw new KeyNotFoundException("User does not exist.");
            if (!string.Equals(inviterRole, "User", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Only ordinary users can invite people.");
            if (!await _context.EventParticipants.AnyAsync(p => p.EventId == eventId && p.UserId == inviterUserId))
                throw new UnauthorizedAccessException("Join the event before inviting people.");

            var normalized = query?.Trim().ToLower() ?? string.Empty;
            var participants = _context.EventParticipants.Where(p => p.EventId == eventId).Select(p => p.UserId);
            var pending = _context.EventInvites
                .Where(i => i.EventId == eventId && i.Status == "Pending")
                .Select(i => i.InviteeUserId);

            return await _context.Users.AsNoTracking()
                .Where(u => u.IsActive && u.Id != inviterUserId &&
                    ((u.AppSettings != null && u.AppSettings.AllowEventInvitesFrom == "Everyone") ||
                     ((u.AppSettings == null || u.AppSettings.AllowEventInvitesFrom == "PeopleIFollow") &&
                        _context.Follows.Any(f => f.FollowerId == u.Id && f.FollowingId == inviterUserId)) ||
                     (u.AppSettings != null && u.AppSettings.AllowEventInvitesFrom == "MatchesOnly" &&
                        _context.UserMatches.Any(m => m.IsActive && m.Source == "QuickMatch" &&
                            ((m.UserAId == inviterUserId && m.UserBId == u.Id) || (m.UserBId == inviterUserId && m.UserAId == u.Id))))) &&
                    !participants.Contains(u.Id) && !pending.Contains(u.Id) &&
                    (normalized == string.Empty || u.Username.ToLower().Contains(normalized)))
                .OrderBy(u => u.Username)
                .Take(12)
                .Select(u => new EventInviteCandidateDto
                {
                    Id = u.Id,
                    Username = u.Username,
                    DisplayName = u.Username,
                    Initials = u.Username.Length <= 2 ? u.Username.ToUpper() : u.Username.Substring(0, 2).ToUpper(),
                    ProfilePicture = u.Profile != null ? u.Profile.ProfilePicture : null,
                    LocationDisplayName = u.Profile == null || u.Profile.LocationPrivacy == "Hidden"
                        ? null
                        : u.Profile.LocationDisplayName ?? u.Profile.LocationCity ?? u.Profile.LocationCountry
                }).ToListAsync();
        }

        public async Task<List<EventInviteDto>> GetPendingForUserAsync(int userId) =>
            await _context.EventInvites.AsNoTracking()
                .Where(i => i.InviteeUserId == userId && i.Status == "Pending")
                .OrderByDescending(i => i.CreatedAt)
                .Select(i => new EventInviteDto
                {
                    Id = i.Id,
                    EventId = i.EventId,
                    EventTitle = i.Event.Title,
                    InviterUserId = i.InviterUserId,
                    InviterUsername = i.InviterUser.Username,
                    InviteeUserId = i.InviteeUserId,
                    Status = i.Status,
                    CreatedAt = i.CreatedAt,
                    RespondedAt = i.RespondedAt
                }).ToListAsync();

        public Task<EventInviteDto> AcceptAsync(int inviteId, int userId) => RespondAsync(inviteId, userId, true);
        public Task<EventInviteDto> DeclineAsync(int inviteId, int userId) => RespondAsync(inviteId, userId, false);

        private async Task<EventInviteDto> RespondAsync(int inviteId, int userId, bool accept)
        {
            var invite = await _context.EventInvites
                .Include(i => i.Event).ThenInclude(e => e.Participants)
                .Include(i => i.InviterUser)
                .FirstOrDefaultAsync(i => i.Id == inviteId)
                ?? throw new KeyNotFoundException("Invitation does not exist.");
            if (invite.InviteeUserId != userId)
                throw new UnauthorizedAccessException("This invitation does not belong to you.");
            var requestedStatus = accept ? "Accepted" : "Declined";
            if (invite.Status != "Pending")
            {
                if (invite.Status == requestedStatus)
                    return Map(invite, invite.Event.Title, invite.InviterUser.Username);
                throw new InvalidOperationException("This invitation has already been answered.");
            }

            if (accept && !invite.Event.Participants.Any(p => p.UserId == userId))
            {
                if (invite.Event.MaxAttendees > 0 && invite.Event.Participants.Count >= invite.Event.MaxAttendees)
                    throw new InvalidOperationException("Event is full.");
                _context.EventParticipants.Add(new EventParticipant { EventId = invite.EventId, UserId = userId });
            }

            invite.Status = requestedStatus;
            invite.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            if (accept)
            {
                var inviteeName = await _context.Users.Where(u => u.Id == userId).Select(u => u.Username).FirstAsync();
                await _notifications.CreateNotificationAsync(invite.InviterUserId, userId,
                    "EventInviteAccepted", "Invitation accepted",
                    $"{inviteeName} accepted your invitation to {invite.Event.Title}.",
                    "Event", invite.EventId, true);
            }

            return Map(invite, invite.Event.Title, invite.InviterUser.Username);
        }

        private static EventInviteDto Map(EventInvite invite, string title, string inviterUsername) => new()
        {
            Id = invite.Id,
            EventId = invite.EventId,
            EventTitle = title,
            InviterUserId = invite.InviterUserId,
            InviterUsername = inviterUsername,
            InviteeUserId = invite.InviteeUserId,
            Status = invite.Status,
            CreatedAt = invite.CreatedAt,
            RespondedAt = invite.RespondedAt
        };
    }
}
