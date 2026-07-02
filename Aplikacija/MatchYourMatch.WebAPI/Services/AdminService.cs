using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Admin;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class AdminService : IAdminService
    {
        private readonly AppDbContext _context;
        private readonly IAccountService _accountService;

        public AdminService(AppDbContext context, IAccountService accountService)
        {
            _context = context;
            _accountService = accountService;
        }

        public async Task<List<CheckUserDto>> GetUserInfoAsync()
        {
            return await _context.Users.Select(u => new CheckUserDto
            {
                Id = u.Id,
                Username = u.Username,
                Email = u.Email,
                Role = u.Role,
                IsActive = u.IsActive
            }).ToListAsync();
        }

        public async Task DeactivateUserAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception("User nije pronadjen");
            user.IsActive = false;
            await _context.SaveChangesAsync();
        }

        public async Task ActivateUserAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception("User nije pronadjen");
            user.IsActive = true;
            await _context.SaveChangesAsync();
        }

        public async Task DeleteUserAsync(int userId, int adminUserId)
        {
            await _accountService.DeleteUserAccountAsync(userId, adminUserId);
        }

        public async Task DeleteEventAsync(int eventId)
        {
            var e = await _context.Events.FindAsync(eventId);
            if (e == null)
                throw new Exception("Event nije pronadjen");
            _context.Events.Remove(e);
            await _context.SaveChangesAsync();
        }

        public async Task DemoteToUserAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception("User nije pronadjen");
            user.Role = "User";
            await _context.SaveChangesAsync();
        }

        public async Task PromoteToAdminAsync(int userId)
        {
            var user = await _context.Users.FindAsync(userId);
            if (user == null)
                throw new Exception("User nije pronadjen");
            user.Role = "Admin";
            await _context.SaveChangesAsync();
        }
    }
}
