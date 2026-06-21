using System.Security.Claims;
using MatchYourMatch.WebAPI.DTOs.Rating;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/Users")]
    [Authorize]
    public class UserRatingsController : ControllerBase
    {
        private readonly IUserRatingService _service;
        public UserRatingsController(IUserRatingService service) => _service = service;

        [HttpGet("{userId:int}/rating-status")]
        public async Task<IActionResult> Status(int userId) => await Execute(() =>
            _service.GetStatusAsync(CurrentUserId(), userId));

        [HttpPost("{userId:int}/ratings")]
        public async Task<IActionResult> Save(int userId, SaveUserRatingDto dto) => await Execute(() =>
            _service.SaveAsync(CurrentUserId(), userId, dto));

        private async Task<IActionResult> Execute(Func<Task<UserRatingStatusDto>> action)
        {
            try { return Ok(await action()); }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    }
}
