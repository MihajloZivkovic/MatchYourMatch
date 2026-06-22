namespace MatchYourMatch.WebAPI.DTOs.Match;

public class QuickMatchRequestDto
{
    public int Id { get; set; }
    public int QuickMatchPostId { get; set; }
    public int RequesterUserId { get; set; }
    public string? RequesterDisplayName { get; set; }
    public string? RequesterAvatar { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
}
