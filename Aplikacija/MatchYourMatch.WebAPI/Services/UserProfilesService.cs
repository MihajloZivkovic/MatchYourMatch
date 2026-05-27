using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.User;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class UserProfilesService : IUserProfilesService
    {
        private readonly AppDbContext _context;

        public UserProfilesService(AppDbContext context)
        {
            _context = context;
        }

        public async Task EditProfileAsync(int userId, EditProfileDto dto)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new Exception("Korisnik nije pronadjen");

            if (user.Profile == null)
            {
                user.Profile = new UserProfile { UserId = userId };
                _context.UserProfiles.Add(user.Profile);
            }

            user.Profile.Bio = dto.Bio;
            user.Profile.ProfilePicture = dto.ProfilePicture;
            user.Profile.Location = dto.Location;

            await _context.SaveChangesAsync();
        }

        public async Task<UserProfileDto> GetProfileAsync(int userId)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new Exception("Korisnik nije pronadjen");

            return new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Bio = user.Profile?.Bio,
                ProfilePicture = user.Profile?.ProfilePicture,
                Location = user.Profile?.Location
            };
        }

        public async Task<List<FreeTimeSlotDto>> GetTimeSlotsAsync(int userId)
        {
            return await _context.FreeTimeSlots
                .Where(s => s.UserId == userId)
                .Select(s => new FreeTimeSlotDto
                {
                    Id = s.Id,
                    DayOfWeek = s.DayOfWeek,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime
                })
                .ToListAsync();
        }

        
        public async Task AddTimeSlotAsync(int userId, CreateFreeTimeSlotDto dto)
        {
            var timeslot = new FreeTimeSlot
            {
                UserId = userId,
                DayOfWeek = dto.DayOfWeek,
                StartTime = dto.StartTime,
                EndTime = dto.EndTime
            };

            _context.FreeTimeSlots.Add(timeslot);
            await _context.SaveChangesAsync();
        }
    }
}
