using MatchYourMatch.WebAPI.DTOs.Match;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "User,Organizer")]
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

        [HttpGet("post/active")]
        public async Task<IActionResult> GetActivePost()
        {
            try
            {
                var post = await _quickMatchService.GetActivePostAsync(GetCurrentUserId());
                return post == null ? NoContent() : Ok(post);
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPut("post/{postId:int}")]
        public async Task<IActionResult> UpdatePost(int postId, [FromBody] CreateQuickMatchRequestDto request)
        {
            try { return Ok(await _quickMatchService.UpdatePostAsync(GetCurrentUserId(), postId, request)); }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, ex.Message); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpDelete("post/{postId:int}")]
        public async Task<IActionResult> DeletePost(int postId)
        {
            try
            {
                await _quickMatchService.DeletePostAsync(GetCurrentUserId(), postId);
                return NoContent();
            }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, ex.Message); }
        }

        [HttpPost("matches")]
        public async Task<IActionResult> GetMatches([FromBody] QuickMatchSearchRequestDto request)
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

        [HttpPost("{postId:int}/requests")]
        public async Task<IActionResult> SendRequest(int postId)
        {
            try { return Ok(await _quickMatchService.SendRequestAsync(GetCurrentUserId(), postId)); }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, ex.Message); }
            catch (InvalidOperationException ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("requests/{requestId:int}/accept")]
        public async Task<IActionResult> AcceptRequest(int requestId)
        {
            try { return Ok(await _quickMatchService.AcceptRequestAsync(GetCurrentUserId(), requestId)); }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, ex.Message); }
            catch (InvalidOperationException ex) { return Conflict(ex.Message); }
        }

        [HttpPost("requests/{requestId:int}/reject")]
        public async Task<IActionResult> RejectRequest(int requestId)
        {
            try { return Ok(await _quickMatchService.RejectRequestAsync(GetCurrentUserId(), requestId)); }
            catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
            catch (UnauthorizedAccessException ex) { return StatusCode(403, ex.Message); }
            catch (InvalidOperationException ex) { return Conflict(ex.Message); }
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
