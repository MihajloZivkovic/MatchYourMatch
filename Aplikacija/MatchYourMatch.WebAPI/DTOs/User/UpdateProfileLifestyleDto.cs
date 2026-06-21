namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class UpdateProfileLifestyleDto
    {
        public List<string> FavoriteActivities { get; set; } = new();
        public int? SocialEnergy { get; set; }
        public string? ConversationStyle { get; set; }
        public List<string> LookingFor { get; set; } = new();
    }
}
