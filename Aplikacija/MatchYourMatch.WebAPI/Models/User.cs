namespace MatchYourMatch.WebAPI.Models
{
    public class User
    {
        public int Id { get; set; }
        public required string Username { get; set; }
        public required string Email { get; set; }
        public required string PasswordHash { get; set; }
        public string Role { get; set; } = "User";
        public bool IsActive { get; set; } = true;
        public UserProfile? Profile { get; set; }
        public UserDeepMatchPreference? DeepMatchPreference { get; set; }
        public List<FreeTimeSlot> FreeTimeSlots { get; set; } = new();
        public List<UserInterest> UserInterests { get; set; } = new();
        public List<Event> Events { get; set; } = new();
        public List<QuickMatchPost> QuickMatchPosts {get; set;} = new();
        public List<Follow> Followers { get; set; } = new();
        public List<Follow> Following { get; set; } = new();
    }
}
