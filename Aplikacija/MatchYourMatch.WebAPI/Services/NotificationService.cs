using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Notification;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class NotificationService : INotificationService
    {
        private readonly AppDbContext _context;

        public NotificationService(AppDbContext context) => _context = context;

        public async Task CreateNotificationAsync(int userId, int? actorUserId, string type,
            string title, string message, string? relatedEntityType = null,
            int? relatedEntityId = null, bool preventDuplicate = false)
        {
            if (IsUnsupportedNotificationType(type))
                return;

            if (actorUserId == userId)
                return;

            var recipientRole = await GetUserRoleAsync(userId);
            if (!CanReceiveNotification(recipientRole, type))
                return;

            var settings = await _context.UserAppSettings.AsNoTracking().FirstOrDefaultAsync(x => x.UserId == userId);
            if (settings != null && !ShouldSend(settings, type))
                return;

            if (preventDuplicate)
            {
                var duplicateSince = DateTime.UtcNow.AddMinutes(-10);
                var exists = await _context.Notifications.AnyAsync(n =>
                    n.UserId == userId && n.ActorUserId == actorUserId && n.Type == type &&
                    n.RelatedEntityType == relatedEntityType && n.RelatedEntityId == relatedEntityId &&
                    n.CreatedAt >= duplicateSince);
                if (exists)
                    return;
            }

            _context.Notifications.Add(new Notification
            {
                UserId = userId,
                ActorUserId = actorUserId,
                Type = type,
                Title = title,
                Message = message,
                RelatedEntityType = relatedEntityType,
                RelatedEntityId = relatedEntityId
            });
            await _context.SaveChangesAsync();
        }

        private static bool ShouldSend(UserAppSettings settings, string type) => type switch
        {
            "EventInvite" => settings.NotifyEventInvites,
            "Follow" => settings.NotifyNewFollowers,
            "QuickMatch" or "QuickMatchRequest" => settings.NotifyQuickMatches,
            "EventStartingSoon" => settings.NotifyEventStartingSoon,
            _ => true
        };

        private static readonly string[] AdminNotificationTypes =
        {
            "AdminReport"
        };

        private static readonly string[] OrganizerNotificationTypes =
        {
            "EventJoinRequest",
            "EventParticipantJoined",
            "EventCapacityReached",
            "EventUpdated",
            "EventCancelled"
        };

        private static readonly string[] OrganizerOnlyNotificationTypes =
        {
            "EventJoinRequest",
            "EventParticipantJoined",
            "EventCapacityReached"
        };

        private static readonly string[] UnsupportedNotificationTypes =
        {
            "ChatMessage",
            "GroupMessage",
            "EventDiscussionReply",
            "NewEventNearby",
            "NewMatchNearby"
        };

        private static bool IsUnsupportedNotificationType(string type) =>
            UnsupportedNotificationTypes.Contains(type);

        private static bool IsOrganizerNotificationAllowed(string type) =>
            OrganizerNotificationTypes.Contains(type);

        private static bool IsAdminNotificationAllowed(string type) =>
            AdminNotificationTypes.Contains(type);

        private static bool IsAdminRole(string? role) =>
            string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(role, "Administrator", StringComparison.OrdinalIgnoreCase);

        private static bool IsOrganizerRole(string? role) =>
            string.Equals(role, "Organizer", StringComparison.OrdinalIgnoreCase);

        private static bool CanReceiveNotification(string? role, string type)
        {
            if (IsAdminRole(role))
                return IsAdminNotificationAllowed(type);

            if (IsOrganizerRole(role))
                return IsOrganizerNotificationAllowed(type);

            return !IsAdminNotificationAllowed(type) && !OrganizerOnlyNotificationTypes.Contains(type);
        }

        private async Task<string?> GetUserRoleAsync(int userId)
        {
            return await _context.Users.AsNoTracking()
                .Where(user => user.Id == userId)
                .Select(user => user.Role)
                .FirstOrDefaultAsync();
        }

        public async Task<List<NotificationDto>> GetNotificationsForUserAsync(int userId, int limit = 50)
        {
            var role = await GetUserRoleAsync(userId);
            var query = _context.Notifications
                .AsNoTracking()
                .Include(n => n.ActorUser)
                    .ThenInclude(u => u!.Profile)
                .Where(n => n.UserId == userId && !UnsupportedNotificationTypes.Contains(n.Type));

            if (IsAdminRole(role))
                query = query.Where(n => AdminNotificationTypes.Contains(n.Type));
            else if (IsOrganizerRole(role))
                query = query.Where(n => OrganizerNotificationTypes.Contains(n.Type));
            else
                query = query.Where(n =>
                    !AdminNotificationTypes.Contains(n.Type) &&
                    !OrganizerOnlyNotificationTypes.Contains(n.Type));

            var notifications = await query
                .OrderByDescending(n => n.CreatedAt)
                .Take(Math.Clamp(limit, 1, 50))
                .ToListAsync();

            var eventIds = notifications
                .Where(n => n.Type == "EventInvite" && n.RelatedEntityId.HasValue)
                .Select(n => n.RelatedEntityId!.Value)
                .Distinct()
                .ToList();
            var invites = eventIds.Count == 0
                ? new List<EventInvite>()
                : await _context.EventInvites.AsNoTracking()
                    .Where(i => i.InviteeUserId == userId && eventIds.Contains(i.EventId))
                    .OrderByDescending(i => i.CreatedAt)
                    .ToListAsync();

            var quickRequestIds = notifications
                .Where(n => n.Type == "QuickMatchRequest" && n.RelatedEntityId.HasValue)
                .Select(n => n.RelatedEntityId!.Value).Distinct().ToList();
            var quickRequests = quickRequestIds.Count == 0
                ? new List<QuickMatchRequest>()
                : await _context.QuickMatchRequests.AsNoTracking()
                    .Where(r => quickRequestIds.Contains(r.Id) && r.QuickMatchPost.UserId == userId)
                    .ToListAsync();

            var joinRequestNotifications = notifications
                .Where(n => n.Type == "EventJoinRequest" && n.RelatedEntityId.HasValue)
                .ToList();
            var joinRequestIds = joinRequestNotifications
                .Where(n => n.RelatedEntityType == "EventJoinRequest")
                .Select(n => n.RelatedEntityId!.Value)
                .Distinct()
                .ToList();
            var legacyJoinRequestEventIds = joinRequestNotifications
                .Where(n => n.RelatedEntityType != "EventJoinRequest" && n.ActorUserId.HasValue)
                .Select(n => n.RelatedEntityId!.Value)
                .Distinct()
                .ToList();
            var joinRequestActorIds = joinRequestNotifications
                .Where(n => n.ActorUserId.HasValue)
                .Select(n => n.ActorUserId!.Value)
                .Distinct()
                .ToList();
            var eventJoinRequests = joinRequestIds.Count == 0 && legacyJoinRequestEventIds.Count == 0
                ? new List<EventJoinRequest>()
                : await _context.EventJoinRequests.AsNoTracking()
                    .Where(r => joinRequestIds.Contains(r.Id) ||
                        (legacyJoinRequestEventIds.Contains(r.EventId) && joinRequestActorIds.Contains(r.UserId)))
                    .OrderByDescending(r => r.RespondedAt ?? r.CreatedAt)
                    .ThenByDescending(r => r.Id)
                    .ToListAsync();

            return notifications.Select(n =>
            {
                var invite = n.Type == "EventInvite"
                    ? invites.FirstOrDefault(i => i.EventId == n.RelatedEntityId && i.InviterUserId == n.ActorUserId)
                    : null;
                var quickRequest = n.Type == "QuickMatchRequest"
                    ? quickRequests.FirstOrDefault(r => r.Id == n.RelatedEntityId)
                    : null;
                var eventJoinRequest = n.Type == "EventJoinRequest"
                    ? n.RelatedEntityType == "EventJoinRequest"
                        ? eventJoinRequests.FirstOrDefault(r => r.Id == n.RelatedEntityId)
                        : eventJoinRequests.FirstOrDefault(r => r.EventId == n.RelatedEntityId && r.UserId == n.ActorUserId)
                    : null;
                return new NotificationDto
                {
                    Id = n.Id,
                    Type = n.Type,
                    Title = n.Title,
                    Message = n.Message,
                    ActorUserId = n.ActorUserId,
                    ActorUsername = n.ActorUser?.Username,
                    ActorDisplayName = n.ActorUser?.Profile?.ShowFullName == true &&
                        !string.IsNullOrWhiteSpace(n.ActorUser.Profile.FullName)
                            ? n.ActorUser.Profile.FullName : n.ActorUser?.Username,
                    ActorAvatar = n.ActorUser?.Profile?.ProfilePicture,
                    RelatedEntityType = n.Type == "EventJoinRequest" ? "Event" : n.RelatedEntityType,
                    RelatedEntityId = n.Type == "EventJoinRequest"
                        ? eventJoinRequest?.EventId ?? n.RelatedEntityId
                        : n.RelatedEntityId,
                    IsRead = n.IsRead,
                    CreatedAt = n.CreatedAt,
                    EventInviteId = invite?.Id,
                    EventInviteStatus = invite?.Status,
                    QuickMatchRequestId = quickRequest?.Id,
                    QuickMatchPostId = quickRequest?.QuickMatchPostId,
                    QuickMatchRequestStatus = quickRequest?.Status,
                    EventJoinRequestId = eventJoinRequest?.Id,
                    EventJoinRequestEventId = eventJoinRequest?.EventId,
                    EventJoinRequestStatus = eventJoinRequest?.Status
                };
            }).ToList();
        }

        public async Task<int> GetUnreadCountAsync(int userId)
        {
            var query = _context.Notifications.Where(n =>
                n.UserId == userId &&
                !n.IsRead &&
                !UnsupportedNotificationTypes.Contains(n.Type));
            var role = await GetUserRoleAsync(userId);
            if (IsAdminRole(role))
                query = query.Where(n => AdminNotificationTypes.Contains(n.Type));
            else if (IsOrganizerRole(role))
                query = query.Where(n => OrganizerNotificationTypes.Contains(n.Type));
            else
                query = query.Where(n =>
                    !AdminNotificationTypes.Contains(n.Type) &&
                    !OrganizerOnlyNotificationTypes.Contains(n.Type));
            return await query.CountAsync();
        }

        public async Task<bool> MarkAsReadAsync(int userId, int notificationId)
        {
            var notification = await _context.Notifications
                .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId);
            if (notification == null)
                return false;
            if (!notification.IsRead)
            {
                notification.IsRead = true;
                notification.ReadAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
            return true;
        }

        public async Task MarkAllAsReadAsync(int userId)
        {
            var now = DateTime.UtcNow;
            var query = _context.Notifications.Where(n =>
                n.UserId == userId &&
                !n.IsRead &&
                !UnsupportedNotificationTypes.Contains(n.Type));
            var role = await GetUserRoleAsync(userId);
            if (IsAdminRole(role))
                query = query.Where(n => AdminNotificationTypes.Contains(n.Type));
            else if (IsOrganizerRole(role))
                query = query.Where(n => OrganizerNotificationTypes.Contains(n.Type));
            else
                query = query.Where(n =>
                    !AdminNotificationTypes.Contains(n.Type) &&
                    !OrganizerOnlyNotificationTypes.Contains(n.Type));
            await query
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(n => n.IsRead, true)
                    .SetProperty(n => n.ReadAt, now));
        }

        public async Task<bool> DeleteAsync(int userId, int notificationId)
        {
            var deleted = await _context.Notifications
                .Where(n => n.Id == notificationId && n.UserId == userId)
                .ExecuteDeleteAsync();
            return deleted > 0;
        }
    }
}
