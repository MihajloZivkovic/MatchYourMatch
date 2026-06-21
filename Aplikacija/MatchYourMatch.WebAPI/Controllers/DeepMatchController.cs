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
        public async Task<IActionResult> GetMatches([FromQuery] string? interests, [FromQuery] string? vibes)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var selectedInterests = SplitFilters(interests);
                var selectedVibes = SplitFilters(vibes);
                var matches = await _deepMatchService.GetMatchesAsync(userId, selectedInterests, selectedVibes);
                return Ok(matches);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        private static List<string> SplitFilters(string? value) => string.IsNullOrWhiteSpace(value)
            ? new List<string>()
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Distinct(StringComparer.OrdinalIgnoreCase).Take(20).ToList();
    }
}
