using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Event;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class EventService: IEventService
    {
        private const int MaxDiscussionMessageLength = 2000;
        private readonly AppDbContext _context;

        public EventService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<EventDto>> GetByQueryAsync(
            int currentUserId,
            string? category,
            bool includePast = false)
        {
            var query = _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                .AsQueryable();

            if (!includePast)
            {
                var localNow = DateTime.Now;
                var today = DateOnly.FromDateTime(localNow);
                var currentTime = TimeOnly.FromDateTime(localNow);

                query = query.Where(e =>
                    e.Date > today ||
                    (e.Date == today && e.Time >= currentTime));
            }

            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(e => e.Interest != null && e.Interest.Name == category);
            }

            var events = await query
                .OrderBy(e => e.Date)
                .ThenBy(e => e.Time)
                .ToListAsync();

            return events.Select(e => ToDto(e, currentUserId)).ToList();
        }

        public async Task<ProfileEventsDto> GetProfileEventsAsync(int currentUserId)
        {
            var events = await _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                .Where(e =>
                    e.Participants.Any(p => p.UserId == currentUserId) ||
                    e.OrganizerId == currentUserId)
                .OrderBy(e => e.Date)
                .ThenBy(e => e.Time)
                .ToListAsync();

            var now = DateTime.Now;
            var joinedEvents = events
                .Select(e => ToDto(e, currentUserId))
                .ToList();

            return new ProfileEventsDto
            {
                Upcoming = joinedEvents
                    .Where(e => ToEventDateTime(e) >= now)
                    .ToList(),
                Past = joinedEvents
                    .Where(e => ToEventDateTime(e) < now)
                    .OrderByDescending(e => e.Date)
                    .ThenByDescending(e => e.Time)
                    .ToList(),
                Saved = new List<EventDto>()
            };
        }

        public async Task<EventDto> GetByIdAsync(int id, int currentUserId)
        {
            var e = await _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                .FirstOrDefaultAsync(e => e.Id == id);
            if (e == null)
                throw new Exception("Event ne postoji");

            return ToDto(e, currentUserId);
        }

        public async Task<EventDto> CreateAsync(int userId, CreateEventDto dto)
        {
            var category = NormalizeCategory(dto.Category);
            var interest = await _context.Interests.FirstOrDefaultAsync(i => i.Name == category);
            if (interest == null)
            {
                interest = new Interest
                {
                    Name = category,
                    Category = "Event"
                };
                _context.Interests.Add(interest);
                await _context.SaveChangesAsync();
            }

            var e = new Event
            {
                Title = dto.Title,
                OrganizerId = userId,
                InterestId = interest.Id,
                Date = dto.Date,
                Time = dto.Time,
                Location = string.IsNullOrWhiteSpace(dto.Location) ? "Community meetup" : dto.Location,
                MaxAttendees = dto.MaxAttendees <= 0 ? 10 : dto.MaxAttendees,
                Description = dto.Description,
                ImageUrl = dto.ImageUrl
            };

            _context.Events.Add(e);
            _context.EventParticipants.Add(new EventParticipant
            {
                Event = e,
                UserId = userId
            });
            await _context.SaveChangesAsync();

            return await GetByIdAsync(e.Id, userId);
        }

        public async Task<EventDto> JoinAsync(int eventId, int userId)
        {
            var e = await _context.Events
                .Include(e => e.Participants)
                .FirstOrDefaultAsync(e => e.Id == eventId);

            if (e == null)
                throw new Exception("Event ne postoji");

            if (e.Participants.Any(p => p.UserId == userId))
                return await GetByIdAsync(eventId, userId);

            if (e.MaxAttendees > 0 && e.Participants.Count >= e.MaxAttendees)
                throw new Exception("Event is full");

            _context.EventParticipants.Add(new EventParticipant
            {
                EventId = eventId,
                UserId = userId
            });
            await _context.SaveChangesAsync();

            return await GetByIdAsync(eventId, userId);
        }

        public async Task<List<EventDiscussionMessageDto>> GetDiscussionAsync(int eventId, int userId)
        {
            await EnsureEventParticipantAsync(eventId, userId);

            var messages = await _context.EventDiscussionMessages
                .AsNoTracking()
                .Include(m => m.User)
                    .ThenInclude(u => u!.Profile)
                .Where(m => m.EventId == eventId && !m.IsDeleted)
                .OrderBy(m => m.CreatedAt)
                .ThenBy(m => m.Id)
                .ToListAsync();

            return messages.Select(message => ToDiscussionDto(message, userId)).ToList();
        }

        public async Task<EventDiscussionMessageDto> AddDiscussionMessageAsync(int eventId, int userId, CreateEventDiscussionMessageDto dto)
        {
            await EnsureEventParticipantAsync(eventId, userId);

            var body = dto.Body?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(body))
                throw new InvalidOperationException("Message cannot be empty.");

            if (body.Length > MaxDiscussionMessageLength)
                throw new InvalidOperationException($"Message cannot be longer than {MaxDiscussionMessageLength} characters.");

            var message = new EventDiscussionMessage
            {
                EventId = eventId,
                UserId = userId,
                Body = body,
                CreatedAt = DateTime.UtcNow
            };

            _context.EventDiscussionMessages.Add(message);
            await _context.SaveChangesAsync();

            message.User = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            return ToDiscussionDto(message, userId);
        }

        public async Task UpdateAsync(int organizerId, int eventId, CreateEventDto dto)
        {
            var e = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
            if (e == null)
                throw new Exception("Event ne postoji");

            if (e.OrganizerId != organizerId)
                throw new Exception("Niste organizator ovog eventa");

            var interest = await _context.Interests.FirstOrDefaultAsync(i => i.Name == NormalizeCategory(dto.Category));
            if (interest == null)
                throw new Exception("Kategorija ne postoji");

            e.Title = dto.Title;
            e.InterestId = interest.Id;
            e.Date = dto.Date;
            e.Time = dto.Time;
            e.Location = dto.Location!;
            e.MaxAttendees = dto.MaxAttendees;
            e.Description = dto.Description;
            e.ImageUrl = dto.ImageUrl;

            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int organizerId, int eventId)
        {
            var e = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
            if (e == null)
                throw new Exception("Event ne postoji");

            if (e.OrganizerId != organizerId)
                throw new Exception("Niste organizator ovog eventa");

            _context.Events.Remove(e);
            await _context.SaveChangesAsync();
        }

        private static string NormalizeCategory(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "Social" : value.Trim();
        }

        private static DateTime ToEventDateTime(EventDto e)
        {
            return e.Date.ToDateTime(e.Time);
        }

        private async Task EnsureEventParticipantAsync(int eventId, int userId)
        {
            var eventExists = await _context.Events.AnyAsync(e => e.Id == eventId);
            if (!eventExists)
                throw new KeyNotFoundException("Event does not exist.");

            var isParticipant = await _context.EventParticipants
                .AnyAsync(p => p.EventId == eventId && p.UserId == userId);

            if (!isParticipant)
                throw new UnauthorizedAccessException("Join the event to open its discussion.");
        }

        private static EventDto ToDto(Event e, int currentUserId)
        {
            var participants = e.Participants
                .OrderBy(p => p.JoinedAt)
                .ToList();

            return new EventDto
            {
                Id = e.Id,
                Title = e.Title,
                Category = e.Interest?.Name,
                Date = e.Date,
                Time = e.Time,
                Location = e.Location,
                MaxAttendees = e.MaxAttendees,
                Description = e.Description,
                ImageUrl = e.ImageUrl,
                CreatedByUserId = e.OrganizerId,
                OrganizerUsername = e.Organizer?.Username,
                ParticipantsCount = participants.Count,
                ParticipantInitials = participants
                    .Take(4)
                    .Select(p => GetInitials(p.User?.Username))
                    .ToList(),
                IsJoinedByCurrentUser = participants.Any(p => p.UserId == currentUserId)
            };
        }

        private static string GetInitials(string? username)
        {
            if (string.IsNullOrWhiteSpace(username))
                return "MY";

            var parts = username
                .Split(new[] { '.', '_', '-', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Take(2)
                .Select(part => char.ToUpperInvariant(part[0]).ToString());

            var initials = string.Join("", parts);
            return string.IsNullOrWhiteSpace(initials) ? "MY" : initials;
        }

        private static EventDiscussionMessageDto ToDiscussionDto(EventDiscussionMessage message, int currentUserId)
        {
            var username = message.User?.Username;

            return new EventDiscussionMessageDto
            {
                Id = message.Id,
                EventId = message.EventId,
                UserId = message.UserId,
                Username = username,
                DisplayName = username,
                Initials = GetInitials(username),
                Avatar = message.User?.Profile?.ProfilePicture,
                Body = message.Body,
                CreatedAt = message.CreatedAt,
                UpdatedAt = message.UpdatedAt,
                IsMine = message.UserId == currentUserId
            };
        }
    }
}
