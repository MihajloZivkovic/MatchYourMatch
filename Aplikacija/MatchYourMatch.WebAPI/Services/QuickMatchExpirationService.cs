using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services;

public sealed class QuickMatchExpirationService : IQuickMatchExpirationService
{
    private readonly AppDbContext _context;

    public QuickMatchExpirationService(AppDbContext context) => _context = context;

    public async Task<int> ExpireDuePostsAsync(int? userId = null, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var dueQuery = _context.QuickMatchPosts
            .Where(post => post.IsActive && post.EndsAtUtc <= now);
        if (userId.HasValue) dueQuery = dueQuery.Where(post => post.UserId == userId.Value);

        var postIds = await dueQuery.Select(post => post.Id).ToListAsync(cancellationToken);
        if (postIds.Count == 0) return 0;

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        await _context.QuickMatchRequests
            .Where(request => postIds.Contains(request.QuickMatchPostId) && request.Status == QuickMatchRequestStatuses.Pending)
            .ExecuteUpdateAsync(update => update
                .SetProperty(request => request.Status, QuickMatchRequestStatuses.Expired)
                .SetProperty(request => request.RespondedAt, now), cancellationToken);
        var changed = await _context.QuickMatchPosts
            .Where(post => postIds.Contains(post.Id) && post.IsActive && post.EndsAtUtc <= now)
            .ExecuteUpdateAsync(update => update
                .SetProperty(post => post.IsActive, false)
                .SetProperty(post => post.ExpiredAt, now), cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return changed;
    }
}
