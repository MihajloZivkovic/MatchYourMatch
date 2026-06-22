namespace MatchYourMatch.WebAPI.Models;

public class SavedEvent
{
    public int UserId { get; set; }
    public int EventId { get; set; }
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Event Event { get; set; } = null!;
}
