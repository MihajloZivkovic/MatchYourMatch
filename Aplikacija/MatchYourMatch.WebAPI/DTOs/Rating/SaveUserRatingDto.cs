namespace MatchYourMatch.WebAPI.DTOs.Rating
{
    public class SaveUserRatingDto
    {
        public int? EventId { get; set; }
        public decimal Rating { get; set; }
    }
}
