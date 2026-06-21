namespace MatchYourMatch.WebAPI.Models
{
    public class UserMatch
    {
        public int Id { get; set; }
        public int UserAId { get; set; }
        public int UserBId { get; set; }
        public string Source { get; set; } = "QuickMatch";
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;
        public int? CompatibilityScore { get; set; }

        public User UserA { get; set; } = null!;
        public User UserB { get; set; } = null!;
    }
}
