namespace MatchYourMatch.WebAPI.DTOs.Match
{
    public class CreateQuickMatchRequestDto
    {
        public TimeOnly StartTime {get; set;}
        public TimeOnly EndTime {get; set;}
        public DateTime StartsAtUtc { get; set; }
        public DateTime EndsAtUtc { get; set; }
        public int ActivityId {get;set;}
        public string? Description {get; set;}
        public int? PreferredMinAge { get; set; }
        public int? PreferredMaxAge { get; set; }
    }
}
