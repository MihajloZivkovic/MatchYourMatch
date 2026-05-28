namespace MatchYourMatch.WebAPI.Models
{
    public class Interest
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public required string Category { get; set; } // Interest || Vibe
        public List<UserInterest> UserInterests { get; set; } = new();
    }
}