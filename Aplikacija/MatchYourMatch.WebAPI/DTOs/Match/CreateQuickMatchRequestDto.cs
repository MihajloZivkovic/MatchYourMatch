namespace MatchYourMatch.WebAPI.DTOs.Match
{
    public class CreateQuickMatchRequestDto
    {
        public TimeOnly StartTime {get; set;}
        public TimeOnly EndTime {get; set;}
        public int ActivityId {get;set;}
        public string? Description {get; set;}
    }
}