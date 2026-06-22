namespace MatchYourMatch.WebAPI.Models;

public static class QuickMatchRequestStatuses
{
    public const string Pending = "Pending";
    public const string Accepted = "Accepted";
    public const string Rejected = "Rejected";
    public const string Expired = "Expired";
}

public class QuickMatchRequest
{
    public int Id { get; set; }
    public int QuickMatchPostId { get; set; }
    public int RequesterUserId { get; set; }
    public string Status { get; set; } = QuickMatchRequestStatuses.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }

    public QuickMatchPost QuickMatchPost { get; set; } = null!;
    public User RequesterUser { get; set; } = null!;
}
