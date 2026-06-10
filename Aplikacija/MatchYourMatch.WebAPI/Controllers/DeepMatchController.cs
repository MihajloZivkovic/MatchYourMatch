using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class DeepMatchController : ControllerBase
    {
        private readonly IDeepMatchService _deepMatchService;

        public DeepMatchController(IDeepMatchService deepMatchService)
        {
            _deepMatchService = deepMatchService;
        }

        [HttpGet("matches")]
        public async Task<IActionResult> GetMatches()
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var matches = await _deepMatchService.GetMatchesAsync(userId);
                return Ok(matches);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
