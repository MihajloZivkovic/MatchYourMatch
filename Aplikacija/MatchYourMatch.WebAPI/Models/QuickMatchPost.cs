namespace MatchYourMatch.WebAPI.Models
{
    public class QuickMatchPost
    {
        public int Id {get; set;}

        public int UserId {get; set;}

        public User User {get; set;} = null!;

        public DateOnly Date {get; set;}

        public TimeOnly StartTime {get; set;}

        public TimeOnly EndTime {get; set;}

        public DateTime StartsAtUtc { get; set; }

        public DateTime EndsAtUtc { get; set; }

        public DateTime? ExpiredAt { get; set; }

        public string? Description {get; set;}

        public bool IsActive {get; set; } = true;

        public int? PreferredMinAge { get; set; }

        public int? PreferredMaxAge { get; set; }

        public DateTime CreatedAt {get; set;} = DateTime.UtcNow;

        public int ActivityId { get; set; }
public Activity Activity { get; set; } = null!;
        public List<QuickMatchRequest> Requests { get; set; } = new();
    }
}
