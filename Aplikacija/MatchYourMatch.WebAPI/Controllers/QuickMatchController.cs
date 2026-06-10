using MatchYourMatch.WebAPI.DTOs.Match;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class QuickMatchController : ControllerBase
    {
        private readonly IQuickMatchService _quickMatchService;

        public QuickMatchController(IQuickMatchService quickMatchService)
        {
            _quickMatchService = quickMatchService;
        }

        [HttpPost("post")]
        public async Task<IActionResult> CreatePost([FromBody] CreateQuickMatchRequestDto request)
        {
            try
            {
                var userId = GetCurrentUserId();

                var post = await _quickMatchService.CreatePostAsync(userId, request);

                return Ok(post);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("matches")]
        public async Task<IActionResult> GetMatches([FromBody] CreateQuickMatchRequestDto request)
        {
            try
            {
                var userId = GetCurrentUserId();

                var matches = await _quickMatchService.GetMatchesAsync(userId, request);

                return Ok(matches);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("today")]
        public async Task<IActionResult> GetTodayPosts()
        {
            try
            {
                var userId = GetCurrentUserId();

                var posts = await _quickMatchService.GetTodayPostsAsync(userId);

                return Ok(posts);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        private int GetCurrentUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);

            if (userIdClaim == null)
                throw new Exception("Korisnik nije ulogovan.");

            return int.Parse(userIdClaim.Value);
        }
    }
}