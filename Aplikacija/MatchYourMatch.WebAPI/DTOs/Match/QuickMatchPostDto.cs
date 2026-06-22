namespace MatchYourMatch.WebAPI.DTOs.Match
{
    public class QuickMatchPostDto
    {
        public int Id { get; set; }

        public int UserId { get; set; }

        public string Username { get; set; } = null!;

        public string? ProfilePicture { get; set; }

        public string? Location { get; set; }

        public int ActivityId { get; set; }

        public string ActivityName { get; set; } = null!;

        public int ActivityCategoryId { get; set; }

        public string ActivityCategoryName { get; set; } = null!;

        public string? Description { get; set; }

        public string StartTime { get; set; } = "";

        public string EndTime { get; set; } = "";
        public DateTime StartsAtUtc { get; set; }
        public DateTime EndsAtUtc { get; set; }

        public int OverlapMinutes { get; set; }
        public int? PreferredMinAge { get; set; }
        public int? PreferredMaxAge { get; set; }
    }
}
