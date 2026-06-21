namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class EventInviteDto
    {
        public int Id { get; set; }
        public int EventId { get; set; }
        public required string EventTitle { get; set; }
        public int InviterUserId { get; set; }
        public required string InviterUsername { get; set; }
        public int InviteeUserId { get; set; }
        public required string Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? RespondedAt { get; set; }
    }
}
