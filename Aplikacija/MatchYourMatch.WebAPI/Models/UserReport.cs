namespace MatchYourMatch.WebAPI.Models
{
    public class UserReport
    {
        public int Id { get; set; }
        public int ReporterUserId { get; set; }
        public int ReportedUserId { get; set; }
        public required string Reason { get; set; }
        public string? Details { get; set; }
        public string Status { get; set; } = "Pending";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? ReviewedAt { get; set; }
        public int? ReviewedByUserId { get; set; }
        public User? ReporterUser { get; set; }
        public User? ReportedUser { get; set; }
        public User? ReviewedByUser { get; set; }
    }
}
