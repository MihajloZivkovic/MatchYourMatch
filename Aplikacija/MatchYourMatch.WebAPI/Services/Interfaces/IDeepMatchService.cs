using MatchYourMatch.WebAPI.DTOs.Match;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IDeepMatchService
    {
        Task<PaginatedMatchesDto> GetMatchesAsync(int userId, IReadOnlyCollection<string>? interests = null, IReadOnlyCollection<string>? vibes = null, int page = 1);
    }
}
