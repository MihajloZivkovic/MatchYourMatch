namespace MatchYourMatch.WebAPI.Models
{
    public class BlockedUser
    {
        public int Id { get; set; }
        public int BlockerUserId { get; set; }
        public int BlockedUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
