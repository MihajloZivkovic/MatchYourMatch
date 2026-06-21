namespace MatchYourMatch.WebAPI.Models
{
    public class HiddenProfile
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int HiddenUserId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
