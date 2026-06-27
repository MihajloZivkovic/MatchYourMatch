namespace MatchYourMatch.WebAPI.DTOs.Report
{
    public class CreateUserReportDto
    {
        public int ReportedUserId { get; set; }
        public required string Reason { get; set; }
        public string? Details { get; set; }
    }
}
