namespace MatchYourMatch.WebAPI.Services.Interfaces;

public interface IQuickMatchExpirationService
{
    Task<int> ExpireDuePostsAsync(int? userId = null, CancellationToken cancellationToken = default);
}
