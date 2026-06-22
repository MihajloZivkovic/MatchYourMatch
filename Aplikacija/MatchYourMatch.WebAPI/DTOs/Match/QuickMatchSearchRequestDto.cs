namespace MatchYourMatch.WebAPI.DTOs.Match;

public class QuickMatchSearchRequestDto
{
    public TimeOnly StartTime { get; set; }
    public TimeOnly EndTime { get; set; }
    public DateTime StartsAtUtc { get; set; }
    public DateTime EndsAtUtc { get; set; }
    public int ActivityId { get; set; }
    public int? MinAge { get; set; }
    public int? MaxAge { get; set; }
}
