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

        public async Task<List<EventDto>> GetByQueryAsync(string? category)
        {
            var query = _context.Events.Include(e => e.Organizer).Include(e => e.Interest).AsQueryable();
            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(e => e.Interest != null && e.Interest.Name == category);
            }

            return await query.Select(e => new EventDto
            {
                Id = e.Id,
                Title = e.Title,
                Category = e.Interest!.Name,
                Date = e.Date,
                Time = e.Time,
                Location = e.Location,
                MaxAttendees = e.MaxAttendees,
                Description = e.Description,
                ImageUrl = e.ImageUrl,
                OrganizerUsername = e.Organizer!.Username
            }).ToListAsync();
        }

        public async Task<EventDto> GetByIdAsync(int id)
        {
            var e = await _context.Events.Include(e => e.Organizer).Include(e => e.Interest)
                .FirstOrDefaultAsync(e => e.Id == id);
            if (e == null)
                throw new Exception("Event ne postoji");

            return new EventDto
            {
                Id = e.Id,
                Title = e.Title,
                Category = e.Interest!.Name,
                Date = e.Date,
                Time = e.Time,
                Location = e.Location,
                MaxAttendees = e.MaxAttendees,
                Description = e.Description,
                ImageUrl = e.ImageUrl,
                OrganizerUsername = e.Organizer!.Username
            };
        }

        public async Task<EventDto> CreateAsync(int organizerId, CreateEventDto dto)
        {
            int? interestId = null;
            if (!string.IsNullOrEmpty(dto.Category))
            {
                var interest = await _context.Interests.FirstOrDefaultAsync(i => i.Name == dto.Category);
                if (interest == null)
                    throw new Exception("Kategorija ne postoji");
                interestId = interest.Id;
            }

            var e = new Event
            {
                Title = dto.Title,
                OrganizerId = organizerId,
                InterestId = interestId,
                Date = dto.Date,
                Time = dto.Time,
                Location = dto.Location!,
                MaxAttendees = dto.MaxAttendees,
                Description = dto.Description,
                ImageUrl = dto.ImageUrl
            };

            _context.Events.Add(e);
            await _context.SaveChangesAsync();

            return await GetByIdAsync(e.Id);
        }

        public async Task UpdateAsync(int organizerId, int eventId, CreateEventDto dto)
        {
            var e = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
            if (e == null)
                throw new Exception("Event ne postoji");

            if (e.OrganizerId != organizerId)
                throw new Exception("Niste organizator ovog eventa");

            int? interestId = null;
            if (!string.IsNullOrEmpty(dto.Category))
            {
                var interest = await _context.Interests.FirstOrDefaultAsync(i => i.Name == dto.Category);
                if (interest == null)
                    throw new Exception("Kategorija ne postoji");
                interestId = interest.Id;
            }

            e.Title = dto.Title;
            e.InterestId = interestId;
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
    }
}
