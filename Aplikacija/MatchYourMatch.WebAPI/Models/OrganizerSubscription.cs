namespace MatchYourMatch.WebAPI.Models
{
    public class OrganizerSubscription
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int OrganizerId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public User User { get; set; } = null!;
        public User Organizer { get; set; } = null!;
    }
}
