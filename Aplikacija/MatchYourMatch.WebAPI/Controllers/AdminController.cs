using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _service;
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<AdminController> _logger;

        public AdminController(
            IAdminService service,
            IWebHostEnvironment environment,
            ILogger<AdminController> logger)
        {
            _service = service;
            _environment = environment;
            _logger = logger;
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers()
        {
            try
            {
                var users = await _service.GetUserInfoAsync();
                return Ok(users);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("users/deactivate/{userId}")]
        public async Task<IActionResult> DeactivateUser(int userId)
        {
            try
            {
                await _service.DeactivateUserAsync(userId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("users/activate/{userId}")]
        public async Task<IActionResult> ActivateUser(int userId)
        {
            try
            {
                await _service.ActivateUserAsync(userId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("users/delete/{userId}")]
        public async Task<IActionResult> DeleteUser(int userId)
        {
            try
            {
                await _service.DeleteUserAsync(userId, CurrentUserId());
                return Ok(new { message = "User deleted successfully." });
            }
            catch (UnauthorizedAccessException ex)
            {
                LogAdminDeleteFailure(ex, userId);
                return StatusCode(StatusCodes.Status403Forbidden, CreateDeleteErrorResponse(ex));
            }
            catch (KeyNotFoundException ex)
            {
                LogAdminDeleteFailure(ex, userId);
                return NotFound(CreateDeleteErrorResponse(ex));
            }
            catch (InvalidOperationException ex)
            {
                LogAdminDeleteFailure(ex, userId);
                return BadRequest(CreateDeleteErrorResponse(ex));
            }
            catch (Exception ex)
            {
                LogAdminDeleteFailure(ex, userId);
                return BadRequest(CreateDeleteErrorResponse(ex));
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("events/{eventId}")]
        public async Task<IActionResult> DeleteEvent(int eventId)
        {
            try
            {
                await _service.DeleteEventAsync(eventId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("users/demote/{userId}")]
        public async Task<IActionResult> DemoteToUser(int userId)
        {
            try
            {
                await _service.DemoteToUserAsync(userId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("users/promote/{userId}")]
        public async Task<IActionResult> PromoteToAdmin(int userId)
        {
            try
            {
                await _service.PromoteToAdminAsync(userId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        private int CurrentUserId()
        {
            var id =
                User.FindFirstValue(ClaimTypes.NameIdentifier) ??
                User.FindFirstValue("sub") ??
                User.FindFirstValue("nameid");

            return int.TryParse(id, out var userId)
                ? userId
                : throw new UnauthorizedAccessException("Invalid admin session.");
        }

        private object CreateDeleteErrorResponse(Exception exception)
        {
            const string message = "User could not be deleted.";

            if (!_environment.IsDevelopment())
                return new { message };

            return new
            {
                message,
                details = GetFullExceptionDetails(exception)
            };
        }

        private void LogAdminDeleteFailure(Exception exception, int targetUserId)
        {
            _logger.LogError(
                exception,
                "Admin delete user failed for TargetUserId {TargetUserId}. InnerException: {InnerException}. StackTrace: {StackTrace}",
                targetUserId,
                exception.InnerException?.Message,
                exception.StackTrace);
        }

        private static string GetFullExceptionDetails(Exception exception)
        {
            var messages = new List<string>();

            for (var current = exception; current != null; current = current.InnerException)
            {
                messages.Add($"{current.GetType().Name}: {current.Message}");
            }

            return string.Join(" | Inner: ", messages);
        }
    }
}
