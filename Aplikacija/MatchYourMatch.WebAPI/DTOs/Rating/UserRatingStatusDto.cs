namespace MatchYourMatch.WebAPI.DTOs.Rating
{
    public class UserRatingStatusDto
    {
        public bool CanRate { get; set; }
        public bool HasRated { get; set; }
        public string? Reason { get; set; }
        public decimal? AverageRating { get; set; }
        public int RatingsCount { get; set; }
        public UserRatingItemDto? MyRating { get; set; }
        public List<UserRatingItemDto> MyRatings { get; set; } = new();
        public List<EligibleRatingEventDto> EligibleEvents { get; set; } = new();
    }
}
