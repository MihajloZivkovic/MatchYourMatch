namespace MatchYourMatch.WebAPI.Models
{
    public class UserRating
    {
        public int Id { get; set; }
        public int RaterUserId { get; set; }
        public int RatedUserId { get; set; }
        public int? EventId { get; set; }
        public decimal Rating { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public User RaterUser { get; set; } = null!;
        public User RatedUser { get; set; } = null!;
        public Event? Event { get; set; }
    }
}
