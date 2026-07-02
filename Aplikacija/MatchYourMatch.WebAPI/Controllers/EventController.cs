using MatchYourMatch.WebAPI.DTOs.Event;
using MatchYourMatch.WebAPI.Services;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Route("api/Events")]
    public class EventController: ControllerBase
    {
        private readonly IEventService _service;

        public EventController(IEventService service)
        {
            _service = service;
        }

        private int GetCurrentUserId() => int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        private bool IsGuest() => User.IsInRole("Guest");
        private bool IsOrganizer() => User.IsInRole("Organizer") ||
            string.Equals(User.FindFirstValue(ClaimTypes.Role), "Organizer", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(User.FindFirstValue("role"), "Organizer", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(User.FindFirstValue("userType"), "Organizer", StringComparison.OrdinalIgnoreCase);
        private string GuestCity() => User.FindFirst("guestCity")?.Value
            ?? throw new UnauthorizedAccessException("Guest city is required.");

        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetEvents(
            [FromQuery] string? category,
            [FromQuery] bool includePast = false)
        {
            try
            {
                if (IsGuest())
                    return Ok(await _service.GetGuestByQueryAsync(GuestCity(), category));

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var events = await _service.GetByQueryAsync(userId, category, includePast);
                return Ok(events);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [AllowAnonymous]
        [HttpGet("cities")]
        public async Task<IActionResult> GetGuestCities()
        {
            return Ok(await _service.GetGuestCitiesAsync());
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetMyEvents()
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var events = await _service.GetProfileEventsAsync(userId);
                return Ok(events);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("saved")]
        public async Task<IActionResult> GetSaved()
        {
            return Ok(await _service.GetSavedEventsAsync(CurrentUserId()));
        }

        [Authorize]
        [HttpPost("{id:int}/save")]
        public async Task<IActionResult> SaveEvent(int id)
        {
            try 
            { 
                return Ok(await _service.SaveEventAsync(id, CurrentUserId())); 
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
        }

        [Authorize]
        [HttpDelete("{id:int}/save")]
        public async Task<IActionResult> UnsaveEvent(int id)
        {
            try 
            { 
                await _service.UnsaveEventAsync(id, CurrentUserId()); 
                return NoContent(); 
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
        }

        [Authorize]
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                if (IsGuest())
                    return Ok(await _service.GetGuestByIdAsync(id, GuestCity()));

                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var e = await _service.GetByIdAsync(id, userId);
                return Ok(e);
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("{id:int}/edit")]
        public async Task<IActionResult> GetForEdit(int id)
        {
            try 
            { 
                return Ok(await _service.GetForEditAsync(id, int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value))); 
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (UnauthorizedAccessException ex) 
            { 
                return StatusCode(403, ex.Message); 
            }
        }

        [Authorize]
        [HttpPost]
        public async Task<IActionResult> Create(CreateEventDto dto)
        {
            try
            {
                if (!IsOrganizer())
                    return StatusCode(StatusCodes.Status403Forbidden, "Only organizers can create events.");
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var e = await _service.CreateAsync(userId, dto);
                return Ok(e);
            }
            catch (UnauthorizedAccessException ex) 
            { 
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message); 
            }
            catch (EventStartInPastException ex)
            {
                return BadRequest(new { errorCode = ex.Code, message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPost("{id}/join")]
        public async Task<IActionResult> Join(int id)
        {
            try
            {
                if (IsGuest())
                    return StatusCode(StatusCodes.Status403Forbidden, "Create an account to join events.");
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var e = await _service.JoinAsync(id, userId);
                return Ok(e);
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (UnauthorizedAccessException ex) 
            { 
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message); 
            }
            catch (InvalidOperationException ex) 
            { 
                return BadRequest(ex.Message); 
            }
        }

        [Authorize]
        [HttpDelete("{id:int}/join")]
        public async Task<IActionResult> Leave(int id)
        {
            try
            {
                if (IsGuest())
                    return StatusCode(StatusCodes.Status403Forbidden, "Create an account to manage event participation.");
                return Ok(await _service.LeaveAsync(id, CurrentUserId()));
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (UnauthorizedAccessException ex) 
            { 
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message); 
            }
            catch (InvalidOperationException ex) 
            { 
                return BadRequest(ex.Message); 
            }
        }

        [Authorize]
        [HttpDelete("{id:int}/join-request")]
        public async Task<IActionResult> CancelJoinRequest(int id)
        {
            try 
            { 
                return Ok(await _service.CancelJoinRequestAsync(id, CurrentUserId())); 
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
        }

        [Authorize]
        [HttpGet("{id:int}/join-requests")]
        public async Task<IActionResult> GetJoinRequests(int id)
        {
            try 
            { 
                return Ok(await _service.GetJoinRequestsAsync(id, CurrentUserId())); 
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (UnauthorizedAccessException ex) 
            { 
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message); 
            }
        }

        [Authorize]
        [HttpPost("{id:int}/join-requests/{requestId:int}/accept")]
        public async Task<IActionResult> AcceptJoinRequest(int id, int requestId)
        {
            return await RespondToJoinRequest(id, requestId, true);
        }

        [Authorize]
        [HttpPost("{id:int}/join-requests/{requestId:int}/reject")]
        public async Task<IActionResult> RejectJoinRequest(int id, int requestId)
        {
            return await RespondToJoinRequest(id, requestId, false);
        }

        [Authorize]
        [HttpPost("{id:int}/invites")]
        public async Task<IActionResult> Invite(int id, CreateEventInviteDto dto,
            [FromServices] IEventInviteService invites)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                return Ok(await invites.CreateAsync(id, userId, dto.InviteeUserId));
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

        [Authorize]
        [HttpGet("{id:int}/invite-candidates")]
        public async Task<IActionResult> InviteCandidates(int id, [FromQuery] string? query,
            [FromServices] IEventInviteService invites)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                return Ok(await invites.SearchCandidatesAsync(id, userId, query));
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (UnauthorizedAccessException ex) 
            { 
                return StatusCode(403, ex.Message); 
            }
        }

        [Authorize]
        [HttpGet("{id:int}/discussion")]
        public async Task<IActionResult> GetDiscussion(int id)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var messages = await _service.GetDiscussionAsync(id, userId);
                return Ok(messages);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "Event discussion could not be loaded.");
            }
        }

        [Authorize]
        [HttpPost("{id:int}/discussion")]
        public async Task<IActionResult> AddDiscussionMessage(int id, CreateEventDiscussionMessageDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var message = await _service.AddDiscussionMessageAsync(id, userId, dto);
                return Ok(message);
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception)
            {
                return StatusCode(
                    StatusCodes.Status500InternalServerError,
                    "Message could not be sent.");
            }
        }

        [Authorize]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, CreateEventDto dto)
        {
            try
            {
                var organizerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.UpdateAsync(organizerId, id, dto);
                return NoContent();
            }
            catch (EventStartInPastException ex)
            {
                return BadRequest(new { errorCode = ex.Code, message = ex.Message });
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var organizerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.DeleteAsync(organizerId, id);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPost("{id:int}/discussion/attachments")]
        [RequestSizeLimit(10 * 1024 * 1024 + 64 * 1024)]
        public async Task<IActionResult> AddDiscussionAttachment(int id, [FromForm] IFormFile file, [FromForm] string? body, CancellationToken cancellationToken)
        {
            try 
            { 
                return Ok(await _service.AddDiscussionAttachmentAsync(id, GetCurrentUserId(), body, file, cancellationToken)); 
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

        [Authorize]
        [HttpPost("{id:int}/discussion/gifs")]
        public async Task<IActionResult> AddDiscussionGif(int id, MatchYourMatch.WebAPI.DTOs.Chat.SendGifMessageDto dto)
        {
            try 
            { 
                return Ok(await _service.AddDiscussionGifAsync(id, GetCurrentUserId(), dto)); 
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

        [Authorize]
        [HttpGet("{id:int}/discussion/attachments/{attachmentId:int}")]
        public async Task<IActionResult> DownloadDiscussionAttachment(int id, int attachmentId, CancellationToken cancellationToken)
        {
            try
            {
                var result = await _service.DownloadDiscussionAttachmentAsync(id, GetCurrentUserId(), attachmentId, cancellationToken);
                Response.Headers.ContentSecurityPolicy = "default-src 'none'; sandbox";
                Response.Headers.XContentTypeOptions = "nosniff";
                return File(result.Stream, result.ContentType, result.FileName, enableRangeProcessing: true);
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (UnauthorizedAccessException ex) 
            { 
                return StatusCode(403, ex.Message); 
            }
        }

        private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        private async Task<IActionResult> RespondToJoinRequest(int eventId, int requestId, bool accept)
        {
            try
            {
                return Ok(await _service.RespondToJoinRequestAsync(
                    eventId, requestId, CurrentUserId(), accept));
            }
            catch (KeyNotFoundException ex) 
            { 
                return NotFound(ex.Message); 
            }
            catch (UnauthorizedAccessException ex) 
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message); 
            }
            catch (InvalidOperationException ex) 
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
