namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class EventJoinRequestDto
    {
        public int Id { get; set; }
        public int EventId { get; set; }
        public int UserId { get; set; }
        public required string Username { get; set; }
        public string? DisplayName { get; set; }
        public string? ProfilePicture { get; set; }
        public required string Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? RespondedAt { get; set; }
    }
}
