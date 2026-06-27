namespace MatchYourMatch.WebAPI.DTOs.Report
{
    public class UserReportHistoryDto
    {
        public int Id { get; set; }
        public int ReportedUserId { get; set; }
        public required string ReportedUsername { get; set; }
        public string? ReportedDisplayName { get; set; }
        public required string Reason { get; set; }
        public string? Details { get; set; }
        public required string Status { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
