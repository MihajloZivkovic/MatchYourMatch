namespace MatchYourMatch.WebAPI.DTOs.Notification
{
    public class NotificationDto
    {
        public int Id { get; set; }
        public required string Type { get; set; }
        public required string Title { get; set; }
        public required string Message { get; set; }
        public int? ActorUserId { get; set; }
        public string? ActorUsername { get; set; }
        public string? ActorDisplayName { get; set; }
        public string? ActorAvatar { get; set; }
        public string? RelatedEntityType { get; set; }
        public int? RelatedEntityId { get; set; }
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
        public int? EventInviteId { get; set; }
        public string? EventInviteStatus { get; set; }
    }
}
