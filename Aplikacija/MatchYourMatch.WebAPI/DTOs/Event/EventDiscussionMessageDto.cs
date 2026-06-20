namespace MatchYourMatch.WebAPI.DTOs.Event
{
    public class EventDiscussionMessageDto
    {
        public int Id { get; set; }
        public int EventId { get; set; }
        public int UserId { get; set; }
        public string? Username { get; set; }
        public string? DisplayName { get; set; }
        public string? Initials { get; set; }
        public string? Avatar { get; set; }
        public required string Body { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public bool IsMine { get; set; }
    }
}
