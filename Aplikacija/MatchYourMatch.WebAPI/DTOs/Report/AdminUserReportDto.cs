namespace MatchYourMatch.WebAPI.DTOs.Report
{
    public class AdminUserReportDto
    {
        public int Id { get; set; }
        public int ReporterUserId { get; set; }
        public string ReporterUsername { get; set; } = "unknown";
        public string? ReporterDisplayName { get; set; }
        public int ReportedUserId { get; set; }
        public string ReportedUsername { get; set; } = "unknown";
        public string? ReportedDisplayName { get; set; }
        public required string Reason { get; set; }
        public string? Details { get; set; }
        public required string Status { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? ReviewedAt { get; set; }
        public int? ReviewedByUserId { get; set; }
        public string? ReviewedByUsername { get; set; }
    }
}
