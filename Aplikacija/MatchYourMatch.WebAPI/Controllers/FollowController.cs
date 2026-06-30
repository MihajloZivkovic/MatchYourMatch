using System.Security.Claims;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class FollowController : ControllerBase
    {
        private readonly IFollowService _service;

        public FollowController(IFollowService service)
        {
            _service = service;
        }

        [Authorize]
        [HttpGet("{userId}/followers")]
        public async Task<IActionResult> GetFollowers(int userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var followers = await _service.GetFollowersAsync(userId, currentUserId, page, pageSize);
                return Ok(followers);
            }
            catch(Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("{userId}/following")]
        public async Task<IActionResult> GetFollowing(int userId, [FromQuery] int page = 1, [FromQuery] int pageSize = 20)
        {
            try
            {
                var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var following = await _service.GetFollowingAsync(userId, currentUserId, page, pageSize);
                return Ok(following);
            }
            catch(Exception ex)
            {
                if (ex is UnauthorizedAccessException)
                    return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPost("{userId}")]
        public async Task<IActionResult> Follow(int userId)
        {
            try
            {
                var followerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.FollowAsync(followerId, userId);
                return NoContent();
            }
            catch(Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpDelete("{userId}")]
        public async Task<IActionResult> Unfollow(int userId)
        {
            try
            {
                var followerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.UnfollowAsync(followerId, userId);
                return NoContent();
            }
            catch(Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("{userId}/is-following")]
        public async Task<IActionResult> IsFollowing(int userId)
        {
            try
            {
                var followerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var res = await _service.IsFollowingAsync(followerId, userId);
                return Ok(res);
            }
            catch(Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
