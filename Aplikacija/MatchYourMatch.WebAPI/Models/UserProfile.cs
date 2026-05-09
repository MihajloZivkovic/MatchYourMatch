namespace MatchYourMatch.WebAPI.Models
{
    public class UserProfile
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public string? Bio { get; set; }
        public string? ProfilePicture { get; set; }
        public string? Location { get; set; }
        public User User { get; set; } = null!;
    }
}
