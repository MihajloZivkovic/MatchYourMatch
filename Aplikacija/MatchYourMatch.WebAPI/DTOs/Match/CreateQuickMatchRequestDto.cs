namespace MatchYourMatch.WebAPI.DTOs.Match
{
    public class CreateQuickMatchRequestDto
    {
        public TimeOnly StartTime {get; set;}
        public TimeOnly EndTime {get; set;}
        public string Activity {get;set;} = null!;
        public string? Description {get; set;}
    }
}