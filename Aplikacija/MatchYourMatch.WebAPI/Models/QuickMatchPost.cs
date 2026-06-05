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

        public string? Description {get; set;}

        public bool IsActive {get; set; } = true;

        public DateTime CreatedAt {get; set;} = DateTime.UtcNow;

        public int ActivityId { get; set; }
public Activity Activity { get; set; } = null!;
    }
}