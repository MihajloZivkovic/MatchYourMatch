namespace MatchYourMatch.WebAPI.DTOs.Rating;

public class UserRatingItemDto
{
    public int Id { get; set; }
    public decimal Rating { get; set; }
    public string EncounterType { get; set; } = "Profile";
    public int? EventId { get; set; }
    public string? EncounterTitle { get; set; }
    public DateTime? EncounterAt { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}
