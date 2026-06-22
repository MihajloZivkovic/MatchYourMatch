using MatchYourMatch.WebAPI.DTOs.Match;
using MatchYourMatch.WebAPI.DTOs.Chat;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IQuickMatchService
    {
        Task<QuickMatchPostDto> CreatePostAsync(
            int userId,
            CreateQuickMatchRequestDto request
        );

        Task<QuickMatchPostDto?> GetActivePostAsync(int userId);
        Task<QuickMatchPostDto> UpdatePostAsync(int userId, int postId, CreateQuickMatchRequestDto request);
        Task DeletePostAsync(int userId, int postId);

        Task<List<QuickMatchPostDto>> GetMatchesAsync(
            int userId,
            QuickMatchSearchRequestDto request
        );

        Task<List<QuickMatchPostDto>> GetTodayPostsAsync(
            int userId
        );

        Task<QuickMatchRequestDto> SendRequestAsync(int userId, int postId);
        Task<QuickMatchRequestDto> AcceptRequestAsync(int userId, int requestId);
        Task<QuickMatchRequestDto> RejectRequestAsync(int userId, int requestId);
    }
}
