using System.Security.Claims;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class NotificationsController : ControllerBase
    {
        private readonly INotificationService _service;
        public NotificationsController(INotificationService service) => _service = service;

        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] int limit = 50) =>
            Ok(await _service.GetNotificationsForUserAsync(CurrentUserId(), limit));

        [HttpGet("unread-count")]
        public async Task<IActionResult> GetUnreadCount() =>
            Ok(new { count = await _service.GetUnreadCountAsync(CurrentUserId()) });

        [HttpPatch("{id:int}/read")]
        public async Task<IActionResult> MarkRead(int id) =>
            await _service.MarkAsReadAsync(CurrentUserId(), id) ? NoContent() : NotFound();

        [HttpPatch("read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            await _service.MarkAllAsReadAsync(CurrentUserId());
            return NoContent();
        }

        [HttpDelete("{id:int}")]
        public async Task<IActionResult> Delete(int id) =>
            await _service.DeleteAsync(CurrentUserId(), id) ? NoContent() : NotFound();

        private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }
}
