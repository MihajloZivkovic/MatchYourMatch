namespace MatchYourMatch.WebAPI.DTOs.Rating
{
    public class EligibleRatingEventDto
    {
        public int EventId { get; set; }
        public required string Title { get; set; }
        public DateTime DateTime { get; set; }
        public decimal? MyRating { get; set; }
    }
}
