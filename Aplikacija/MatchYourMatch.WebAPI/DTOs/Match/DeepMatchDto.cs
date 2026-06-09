namespace MatchYourMatch.WebAPI.DTOs.Match
{
    public class DeepMatchDto
    {
        public int UserId { get; set; }

        public string Username { get; set; } = null!;

        public string DisplayName { get; set; } = null!;

        public string Initials { get; set; } = null!;

        public string? Location { get; set; }

        public string? ApproximateDistanceLabel { get; set; }

        public string? LocationReason { get; set; }

        public string? About { get; set; }

        public int CompatibilityScore { get; set; }

        public List<string> SharedActivities { get; set; } = new();

        public List<string> SharedInterests { get; set; } = new();

        public List<string> OverlappingAvailability { get; set; } = new();

        public List<string> Reasons { get; set; } = new();
    }
}
