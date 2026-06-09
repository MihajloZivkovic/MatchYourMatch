using MatchYourMatch.WebAPI.DTOs.Match;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IDeepMatchService
    {
        Task<List<DeepMatchDto>> GetMatchesAsync(int userId);
    }
}
