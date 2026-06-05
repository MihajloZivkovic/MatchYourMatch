namespace MatchYourMatch.WebAPI.DTOs.Match
{
    public class QuickMatchPostDto
    {
        public int Id {get; set;}

        public int UserId {get; set;}

        public string Username{get;set;}=null!;

        public string? Location{get; set;}

        public string Activity{get; set;}=null!;

        public string? Description{get;set;}

        public string StartTime{get;set;}="";

        public string EndTime{get;set;}="";

        public int OverlapMinutes{get;set;}

        public int MatchScore {get; set;}

        public string Reason {get; set; } = "";

    }
}