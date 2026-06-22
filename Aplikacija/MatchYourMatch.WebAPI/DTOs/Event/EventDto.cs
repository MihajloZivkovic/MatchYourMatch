namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class EventDto
    {
        public int Id { get; set; }
        public required string Title { get; set; }
        public string? Category { get; set; }
        public DateOnly Date { get; set; }
        public TimeOnly Time { get; set; }
        public required string Location { get; set; }
        public bool ShowFullAddress { get; set; }
        public int MaxAttendees { get; set; }
        public int? MinAge { get; set; }
        public int? MaxAge { get; set; }
        public bool RequiresParticipantApproval { get; set; }
        public string? Description { get; set; }
        public string? ImageUrl { get; set; }
        public int? CreatedByUserId { get; set; }
        public string? OrganizerUsername { get; set; }
        public string EventType { get; set; } = "UserCreated";
        public int ParticipantsCount { get; set; }
        public List<string> ParticipantInitials { get; set; } = new();
        public List<EventParticipantAvatarDto> ParticipantAvatars { get; set; } = new();
        public bool IsJoinedByCurrentUser { get; set; }
        public bool IsOrganizer { get; set; }
        public string? JoinRequestStatus { get; set; }
        public int PendingJoinRequestsCount { get; set; }
        public bool IsSaved { get; set; }
    }
}
