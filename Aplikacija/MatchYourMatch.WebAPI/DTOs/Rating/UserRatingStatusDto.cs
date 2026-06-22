namespace MatchYourMatch.WebAPI.DTOs.Rating
{
    public class UserRatingStatusDto
    {
        public bool CanRate { get; set; }
        public string? Reason { get; set; }
        public decimal? AverageRating { get; set; }
        public int RatingsCount { get; set; }
        public decimal? MyRating { get; set; }
        public List<UserRatingItemDto> MyRatings { get; set; } = new();
        public List<EligibleRatingEventDto> EligibleEvents { get; set; } = new();
    }
}
