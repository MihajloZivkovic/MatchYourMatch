using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class EventReminderService : IEventReminderService
    {
        private static readonly TimeSpan MainReminderOffset = TimeSpan.FromHours(24);
        private static readonly TimeSpan ShortReminderOffset = TimeSpan.FromHours(1);
        private static readonly TimeSpan MinimumImmediateWindow = TimeSpan.FromMinutes(15);

        private readonly AppDbContext _context;
        private readonly INotificationService _notifications;
        private readonly EmailService _email;
        private readonly ILogger<EventReminderService> _logger;

        public EventReminderService(
            AppDbContext context,
            INotificationService notifications,
            EmailService email,
            ILogger<EventReminderService> logger)
        {
            _context = context;
            _notifications = notifications;
            _email = email;
            _logger = logger;
        }

        public async Task ScheduleForParticipantAsync(int eventId, int userId, CancellationToken cancellationToken = default)
        {
            var eventInfo = await _context.Events
                .AsNoTracking()
                .Where(e => e.Id == eventId)
                .Select(e => new { e.Id, e.Date, e.Time })
                .FirstOrDefaultAsync(cancellationToken);

            if (eventInfo == null)
                return;

            var reminderAt = CalculateReminderAt(eventInfo.Date, eventInfo.Time);
            if (reminderAt == null)
            {
                await CancelForParticipantAsync(eventId, userId, cancellationToken);
                return;
            }

            var reminder = await _context.EventReminders
                .FirstOrDefaultAsync(r => r.EventId == eventId && r.UserId == userId, cancellationToken);

            if (reminder == null)
            {
                _context.EventReminders.Add(new EventReminder
                {
                    EventId = eventId,
                    UserId = userId,
                    ReminderAt = reminderAt.Value
                });
            }
            else if (reminder.SentAt == null)
            {
                reminder.ReminderAt = reminderAt.Value;
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task CancelForParticipantAsync(int eventId, int userId, CancellationToken cancellationToken = default)
        {
            await _context.EventReminders
                .Where(r => r.EventId == eventId && r.UserId == userId && r.SentAt == null)
                .ExecuteDeleteAsync(cancellationToken);
        }

        public async Task CancelForEventAsync(int eventId, CancellationToken cancellationToken = default)
        {
            await _context.EventReminders
                .Where(r => r.EventId == eventId && r.SentAt == null)
                .ExecuteDeleteAsync(cancellationToken);
        }

        public async Task RescheduleForEventAsync(int eventId, CancellationToken cancellationToken = default)
        {
            var e = await _context.Events
                .AsNoTracking()
                .Include(value => value.Participants)
                .FirstOrDefaultAsync(value => value.Id == eventId, cancellationToken);

            if (e == null)
            {
                await CancelForEventAsync(eventId, cancellationToken);
                return;
            }

            var reminderAt = CalculateReminderAt(e.Date, e.Time);
            if (reminderAt == null)
            {
                await CancelForEventAsync(eventId, cancellationToken);
                return;
            }

            var participantIds = e.Participants
                .Select(p => p.UserId)
                .Where(userId => e.OrganizerId == null || userId != e.OrganizerId.Value)
                .Distinct()
                .ToList();
            if (participantIds.Count == 0)
            {
                await CancelForEventAsync(eventId, cancellationToken);
                return;
            }

            await _context.EventReminders
                .Where(r => r.EventId == eventId && !participantIds.Contains(r.UserId))
                .ExecuteDeleteAsync(cancellationToken);

            var reminders = await _context.EventReminders
                .Where(r => r.EventId == eventId)
                .ToListAsync(cancellationToken);
            var existingUserIds = reminders.Select(r => r.UserId).ToHashSet();

            foreach (var reminder in reminders)
            {
                reminder.ReminderAt = reminderAt.Value;
                reminder.SentAt = null;
            }

            foreach (var userId in participantIds.Where(userId => !existingUserIds.Contains(userId)))
            {
                _context.EventReminders.Add(new EventReminder
                {
                    EventId = eventId,
                    UserId = userId,
                    ReminderAt = reminderAt.Value
                });
            }

            await _context.SaveChangesAsync(cancellationToken);
        }

        public async Task ProcessDueRemindersAsync(CancellationToken cancellationToken = default)
        {
            var now = DateTime.UtcNow;
            var dueIds = await _context.EventReminders
                .AsNoTracking()
                .Where(r => r.SentAt == null && r.ReminderAt <= now)
                .OrderBy(r => r.ReminderAt)
                .Select(r => r.Id)
                .Take(25)
                .ToListAsync(cancellationToken);

            foreach (var reminderId in dueIds)
                await ProcessReminderAsync(reminderId, cancellationToken);
        }

        private async Task ProcessReminderAsync(int reminderId, CancellationToken cancellationToken)
        {
            var claimedAt = DateTime.UtcNow;
            var claimed = await _context.EventReminders
                .Where(r => r.Id == reminderId && r.SentAt == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(r => r.SentAt, claimedAt), cancellationToken);

            if (claimed == 0)
                return;

            var reminder = await _context.EventReminders
                .AsNoTracking()
                .Include(r => r.Event)
                .Include(r => r.User)
                    .ThenInclude(u => u.AppSettings)
                .FirstOrDefaultAsync(r => r.Id == reminderId, cancellationToken);

            if (reminder == null)
                return;

            var isStillParticipant = await _context.EventParticipants
                .AsNoTracking()
                .AnyAsync(p => p.EventId == reminder.EventId && p.UserId == reminder.UserId, cancellationToken);
            if (!isStillParticipant || reminder.Event.Date.ToDateTime(reminder.Event.Time) <= DateTime.Now)
                return;

            var localStart = reminder.Event.Date.ToDateTime(reminder.Event.Time);
            var timeText = localStart.ToString("HH:mm");
            var title = $"Reminder: {reminder.Event.Title}";
            var message = $"Reminder: {reminder.Event.Title} starts tomorrow at {timeText}.";

            await _notifications.CreateNotificationAsync(reminder.UserId, reminder.Event.OrganizerId,
                "EventStartingSoon", title, message, "Event", reminder.EventId, preventDuplicate: true);

            try
            {
                await _email.SendEventReminderAsync(
                    reminder.User.Email,
                    reminder.Event.Title,
                    localStart,
                    GetPublicLocation(reminder.Event));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Event reminder email could not be sent for reminder {ReminderId}.", reminderId);
            }
        }

        private static DateTime? CalculateReminderAt(DateOnly date, TimeOnly time)
        {
            var eventLocal = date.ToDateTime(time);
            var nowLocal = DateTime.Now;
            var untilStart = eventLocal - nowLocal;

            if (untilStart <= TimeSpan.Zero)
                return null;
            if (untilStart <= MinimumImmediateWindow)
                return null;

            var reminderLocal = untilStart > MainReminderOffset
                ? eventLocal.Subtract(MainReminderOffset)
                : untilStart > ShortReminderOffset
                    ? eventLocal.Subtract(ShortReminderOffset)
                    : nowLocal;

            return DateTime.SpecifyKind(reminderLocal, DateTimeKind.Local).ToUniversalTime();
        }

        private static string GetPublicLocation(Event eventItem)
        {
            if (eventItem.ShowFullAddress) return eventItem.Location;
            var parts = new[] { eventItem.LocationCity, eventItem.LocationCountry }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase);
            var location = string.Join(", ", parts);
            return string.IsNullOrWhiteSpace(location) ? "Location not shared" : location;
        }
    }
}
