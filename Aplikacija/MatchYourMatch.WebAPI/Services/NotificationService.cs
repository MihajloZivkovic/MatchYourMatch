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
            if (actorUserId == userId)
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
            "ChatMessage" => settings.NotifyChatMessages,
            "GroupMessage" => settings.NotifyGroupMessages,
            "EventDiscussionReply" => settings.NotifyEventDiscussionReplies,
            "NewEventNearby" => settings.NotifyNewEventNearby,
            "EventStartingSoon" => settings.NotifyEventStartingSoon,
            "NewMatchNearby" => settings.NotifyNewMatchNearby,
            _ => true
        };

        public async Task<List<NotificationDto>> GetNotificationsForUserAsync(int userId, int limit = 50)
        {
            var notifications = await _context.Notifications
                .AsNoTracking()
                .Include(n => n.ActorUser)
                    .ThenInclude(u => u!.Profile)
                .Where(n => n.UserId == userId)
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
                .Where(n => n.Type == "EventJoinRequest" && n.RelatedEntityId.HasValue && n.ActorUserId.HasValue)
                .ToList();
            var joinRequestEventIds = joinRequestNotifications.Select(n => n.RelatedEntityId!.Value).Distinct().ToList();
            var joinRequestActorIds = joinRequestNotifications.Select(n => n.ActorUserId!.Value).Distinct().ToList();
            var eventJoinRequests = joinRequestEventIds.Count == 0
                ? new List<EventJoinRequest>()
                : await _context.EventJoinRequests.AsNoTracking()
                    .Where(r => joinRequestEventIds.Contains(r.EventId) && joinRequestActorIds.Contains(r.UserId))
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
                    ? eventJoinRequests.FirstOrDefault(r => r.EventId == n.RelatedEntityId && r.UserId == n.ActorUserId)
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
                            ? n.ActorUser.Profile.FullName
                            : n.ActorUser?.Username,
                    ActorAvatar = n.ActorUser?.Profile?.ProfilePicture,
                    RelatedEntityType = n.RelatedEntityType,
                    RelatedEntityId = n.RelatedEntityId,
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

        public Task<int> GetUnreadCountAsync(int userId) =>
            _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);

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
            await _context.Notifications
                .Where(n => n.UserId == userId && !n.IsRead)
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
