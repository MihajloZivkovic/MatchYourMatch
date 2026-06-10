using MatchYourMatch.WebAPI.DTOs.Match;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IQuickMatchService
    {
        Task<QuickMatchPostDto> CreatePostAsync(
            int userId,
            CreateQuickMatchRequestDto request
        );

        Task<List<QuickMatchPostDto>> GetMatchesAsync(
            int userId,
            CreateQuickMatchRequestDto request
        );

        Task<List<QuickMatchPostDto>> GetTodayPostsAsync(
            int userId
        );
    }
}