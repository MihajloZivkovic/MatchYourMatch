namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IEventReminderService
    {
        Task ScheduleForParticipantAsync(int eventId, int userId, CancellationToken cancellationToken = default);
        Task CancelForParticipantAsync(int eventId, int userId, CancellationToken cancellationToken = default);
        Task CancelForEventAsync(int eventId, CancellationToken cancellationToken = default);
        Task RescheduleForEventAsync(int eventId, CancellationToken cancellationToken = default);
        Task ProcessDueRemindersAsync(CancellationToken cancellationToken = default);
    }
}
