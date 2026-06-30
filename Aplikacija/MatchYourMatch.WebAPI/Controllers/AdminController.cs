using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AdminController : ControllerBase
    {
        private readonly IAdminService _service;

        public AdminController(IAdminService service)
        {
            _service = service;
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
                await _service.DeleteUserAsync(userId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
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
    }
}
