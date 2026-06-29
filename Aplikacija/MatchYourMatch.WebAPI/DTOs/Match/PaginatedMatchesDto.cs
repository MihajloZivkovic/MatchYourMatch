namespace MatchYourMatch.WebAPI.DTOs.Match;

public class PaginatedMatchesDto
{
    public List<DeepMatchDto> Matches { get; set; } = new();
    public int CurrentPage { get; set; }
    public int TotalPages { get; set; }
}
