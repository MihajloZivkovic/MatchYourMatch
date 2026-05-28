namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class InterestDto
    {
        public int Id { get; set; }
        public required string Name { get; set; }
        public required string Category { get; set; }
    }
}
