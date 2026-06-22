using MatchYourMatch.WebAPI.Services.Interfaces;

namespace MatchYourMatch.WebAPI.Services;

public sealed class QuickMatchExpirationWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<QuickMatchExpirationWorker> _logger;

    public QuickMatchExpirationWorker(IServiceScopeFactory scopeFactory, ILogger<QuickMatchExpirationWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var expiration = scope.ServiceProvider.GetRequiredService<IQuickMatchExpirationService>();
                await expiration.ExpireDuePostsAsync(cancellationToken: stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception exception)
            {
                _logger.LogError(exception, "Quick Match expiration sweep failed.");
            }

            if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
        }
    }
}
