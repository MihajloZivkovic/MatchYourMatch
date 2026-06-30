using MatchYourMatch.WebAPI.Services.Interfaces;

namespace MatchYourMatch.WebAPI.Services
{
    public class EventReminderWorker : BackgroundService
    {
        private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILogger<EventReminderWorker> _logger;

        public EventReminderWorker(IServiceScopeFactory scopeFactory, ILogger<EventReminderWorker> logger)
        {
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            while (!stoppingToken.IsCancellationRequested)
            {
                try
                {
                    using var scope = _scopeFactory.CreateScope();
                    var reminders = scope.ServiceProvider.GetRequiredService<IEventReminderService>();
                    await reminders.ProcessDueRemindersAsync(stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Event reminder worker failed while processing due reminders.");
                }

                await Task.Delay(PollInterval, stoppingToken);
            }
        }
    }
}
