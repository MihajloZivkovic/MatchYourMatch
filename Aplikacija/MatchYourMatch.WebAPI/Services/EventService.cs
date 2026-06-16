using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Event;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class EventService: IEventService
    {
        private readonly AppDbContext _context;

        public EventService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<EventDto>> GetByQueryAsync(int currentUserId, string? category)
        {
            var query = _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                .AsQueryable();

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
    }
}
