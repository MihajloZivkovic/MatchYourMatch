using System.Security.Claims;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/Events/invites")]
    [Authorize]
    public class EventInvitesController : ControllerBase
    {
        private readonly IEventInviteService _service;
        public EventInvitesController(IEventInviteService service) 
            => _service = service;

        [HttpGet("me")]
        public async Task<IActionResult> Mine() 
            => Ok(await _service.GetPendingForUserAsync(CurrentUserId()));

        [HttpPost("{inviteId:int}/accept")]
        public async Task<IActionResult> Accept(int inviteId) 
            => await Execute(() => _service.AcceptAsync(inviteId, CurrentUserId()));

        [HttpPost("{inviteId:int}/decline")]
        public async Task<IActionResult> Decline(int inviteId) 
            => await Execute(() => _service.DeclineAsync(inviteId, CurrentUserId()));

        private async Task<IActionResult> Execute(Func<Task<DTOs.Event.EventInviteDto>> action)
        {
            try 
            { 
                return Ok(await action()); 
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (UnauthorizedAccessException ex) 
            { 
                return StatusCode(403, ex.Message);
            }
            catch (InvalidOperationException ex) 
            { 
                return BadRequest(ex.Message); 
            }
        }

        private int CurrentUserId() 
            => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }
}
