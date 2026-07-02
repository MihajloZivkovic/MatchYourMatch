using System.Security.Claims;
using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Settings;
using MatchYourMatch.WebAPI.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController, Route("api/[controller]"), Authorize]
    public class SettingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        public SettingsController(AppDbContext context) 
            => _context = context;

        [HttpGet("me")]
        public async Task<ActionResult<UserAppSettingsDto>> Get()
        {
            if (IsOrganizer())
                return StatusCode(StatusCodes.Status403Forbidden, "Organizer settings are limited to appearance and language.");
            return Ok(Map(await GetOrCreate(CurrentUserId())));
        }

        [HttpPut("me")]
        public async Task<ActionResult<UserAppSettingsDto>> Put(UserAppSettingsDto dto)
        {
            if (IsOrganizer())
                return StatusCode(StatusCodes.Status403Forbidden, "Organizer settings are limited to appearance and language.");

            if (dto.MaximumDistanceKm is < 1 or > 200 || dto.MinAge is < 16 or > 100 ||
                dto.MaxAge is < 16 or > 100 || dto.MinAge > dto.MaxAge)
                return BadRequest("Distance or age range is invalid.");

            var settings = await GetOrCreate(CurrentUserId());
            settings.MaximumDistanceKm = dto.MaximumDistanceKm;
            settings.ShowMeInQuickMatch = dto.ShowMeInQuickMatch;
            settings.ShowMeInDeepMatch = dto.ShowMeInDeepMatch;
            settings.PreferPeopleNearby = dto.PreferPeopleNearby;
            settings.MinAge = dto.MinAge;
            settings.MaxAge = dto.MaxAge;
            settings.WhoCanMessageMe = Normalize(dto.WhoCanMessageMe, "MatchesOnly", "PeopleIFollow", "Followers", "Everyone");
            settings.AllowEventInvitesFrom = Normalize(dto.AllowEventInvitesFrom, "PeopleIFollow", "MatchesOnly", "Everyone");
            settings.AllowGroupChatInvitesFrom = Normalize(dto.AllowGroupChatInvitesFrom, "MatchesOnly", "PeopleIFollow", "Everyone");
            settings.NotifyEventInvites = dto.NotifyEventInvites;
            settings.NotifyNewFollowers = dto.NotifyNewFollowers;
            settings.NotifyQuickMatches = dto.NotifyQuickMatches;
            settings.NotifyChatMessages = dto.NotifyChatMessages;
            settings.NotifyGroupMessages = dto.NotifyGroupMessages;
            settings.NotifyEventDiscussionReplies = dto.NotifyEventDiscussionReplies;
            settings.NotifyNewEventNearby = dto.NotifyNewEventNearby;
            settings.NotifyEventStartingSoon = dto.NotifyEventStartingSoon;
            settings.NotifyNewMatchNearby = dto.NotifyNewMatchNearby;

            await _context.SaveChangesAsync();
            return Ok(Map(settings));
        }

        [HttpGet("blocked-users")]
        public async Task<ActionResult<List<SafetyUserDto>>> Blocked()
        {
            if (IsOrganizer())
                return StatusCode(StatusCodes.Status403Forbidden, "Organizer safety settings are not available.");
            return Ok(await SafetyList(_context.BlockedUsers.Where(x => x.BlockerUserId == CurrentUserId()).Select(x => x.BlockedUserId)));
        }

        [HttpPost("blocked-users/{userId:int}")]
        public async Task<IActionResult> Block(int userId) 
            => await AddSafety(userId, true);

        [HttpDelete("blocked-users/{userId:int}")]
        public async Task<IActionResult> Unblock(int userId) 
        { 
            if (IsOrganizer()) 
                return StatusCode(StatusCodes.Status403Forbidden, "Organizer safety settings are not available."); 
            await _context.BlockedUsers.Where(x => x.BlockerUserId == CurrentUserId() && x.BlockedUserId == userId).ExecuteDeleteAsync(); 
            return NoContent(); 
        }

        [HttpGet("hidden-profiles")]
        public async Task<ActionResult<List<SafetyUserDto>>> Hidden()
        {
            if (IsOrganizer())
                return StatusCode(StatusCodes.Status403Forbidden, "Organizer safety settings are not available.");
            return Ok(await SafetyList(_context.HiddenProfiles.Where(x => x.UserId == CurrentUserId()).Select(x => x.HiddenUserId)));
        }

        [HttpPost("hidden-profiles/{userId:int}")]
        public async Task<IActionResult> Hide(int userId) 
            => await AddSafety(userId, false);

        [HttpDelete("hidden-profiles/{userId:int}")]
        public async Task<IActionResult> Unhide(int userId) 
        { 
            if (IsOrganizer()) 
                return StatusCode(StatusCodes.Status403Forbidden, "Organizer safety settings are not available."); 
            await _context.HiddenProfiles.Where(x => x.UserId == CurrentUserId() && x.HiddenUserId == userId).ExecuteDeleteAsync(); 
            return NoContent(); 
        }

        private async Task<IActionResult> AddSafety(int targetId, bool block)
        {
            if (IsOrganizer())
                return StatusCode(StatusCodes.Status403Forbidden, "Organizer safety settings are not available.");
            var me = CurrentUserId();

            if (targetId == me || !await _context.Users.AnyAsync(u => u.Id == targetId && u.IsActive)) 
                return BadRequest();

            if (block && !await _context.BlockedUsers.AnyAsync(x => x.BlockerUserId == me && x.BlockedUserId == targetId))
                _context.BlockedUsers.Add(new BlockedUser { BlockerUserId = me, BlockedUserId = targetId });

            if (!block && !await _context.HiddenProfiles.AnyAsync(x => x.UserId == me && x.HiddenUserId == targetId))
                _context.HiddenProfiles.Add(new HiddenProfile { UserId = me, HiddenUserId = targetId });

            await _context.SaveChangesAsync(); 
            return NoContent();
        }

        private async Task<List<SafetyUserDto>> SafetyList(IQueryable<int> ids) => await _context.Users.AsNoTracking()
            .Where(u => ids.Contains(u.Id)).Select(u => new SafetyUserDto { 
                UserId = u.Id, 
                Username = u.Username, 
                ProfilePicture = u.Profile != null ? u.Profile.ProfilePicture : null })
                .ToListAsync();
                
        private async Task<UserAppSettings> GetOrCreate(int userId)
        {
            var value = await _context.UserAppSettings.FirstOrDefaultAsync(x => x.UserId == userId);
            if (value != null) 
                return value;
            value = new UserAppSettings 
            { 
                UserId = userId 
            }; 

            _context.UserAppSettings.Add(value); 
            await _context.SaveChangesAsync(); 
            return value;
        }

        private static string Normalize(string value, params string[] allowed) 
            => allowed.Contains(value) ? value : allowed[0];

        private int CurrentUserId() 
            => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        private bool IsOrganizer() 
            => string.Equals(User.FindFirstValue(ClaimTypes.Role), "Organizer", StringComparison.OrdinalIgnoreCase);
        
        private static UserAppSettingsDto Map(UserAppSettings x) 
            => new() 
            {
                MaximumDistanceKm=x.MaximumDistanceKm, 
                ShowMeInQuickMatch=x.ShowMeInQuickMatch, 
                ShowMeInDeepMatch=x.ShowMeInDeepMatch, 
                PreferPeopleNearby=x.PreferPeopleNearby,
                MinAge=x.MinAge, 
                MaxAge=x.MaxAge, 
                WhoCanMessageMe=x.WhoCanMessageMe, 
                AllowEventInvitesFrom=x.AllowEventInvitesFrom, 
                AllowGroupChatInvitesFrom=x.AllowGroupChatInvitesFrom,
                NotifyEventInvites=x.NotifyEventInvites, 
                NotifyNewFollowers=x.NotifyNewFollowers, 
                NotifyQuickMatches=x.NotifyQuickMatches, 
                NotifyChatMessages=x.NotifyChatMessages,
                NotifyGroupMessages=x.NotifyGroupMessages, 
                NotifyEventDiscussionReplies=x.NotifyEventDiscussionReplies, 
                NotifyNewEventNearby=x.NotifyNewEventNearby,
                NotifyEventStartingSoon=x.NotifyEventStartingSoon, 
                NotifyNewMatchNearby=x.NotifyNewMatchNearby 
            };
    }
}
