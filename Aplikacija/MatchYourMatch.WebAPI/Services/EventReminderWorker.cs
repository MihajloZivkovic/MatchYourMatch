using MatchYourMatch.WebAPI.Services.Interfaces;

namespace MatchYourMatch.WebAPI.Services
{
    public class EventReminderWorker : BackgroundService
    {
        private static readonly TimeSpan PollInterval = TimeSpan.FromMinutes(1);
        private readonly IServiceScopeFactory _scopeFactory;

        public EventReminderWorker(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
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

                await Task.Delay(PollInterval, stoppingToken);
            }
        }
    }
}
