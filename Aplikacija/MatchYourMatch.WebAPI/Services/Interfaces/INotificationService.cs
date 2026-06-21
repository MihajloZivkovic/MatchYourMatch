using MatchYourMatch.WebAPI.DTOs.Notification;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface INotificationService
    {
        Task CreateNotificationAsync(int userId, int? actorUserId, string type, string title,
            string message, string? relatedEntityType = null, int? relatedEntityId = null,
            bool preventDuplicate = false);
        Task<List<NotificationDto>> GetNotificationsForUserAsync(int userId, int limit = 50);
        Task<int> GetUnreadCountAsync(int userId);
        Task<bool> MarkAsReadAsync(int userId, int notificationId);
        Task MarkAllAsReadAsync(int userId);
        Task<bool> DeleteAsync(int userId, int notificationId);
    }
}
