using MatchYourMatch.WebAPI.DTOs.User;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserProfileController: ControllerBase
    {
        private readonly IUserProfilesService _service;

        public UserProfileController(IUserProfilesService service)
        {
            _service = service;
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetProfile(int id)
        {
            try
            {
                var profile = await _service.GetProfileAsync(id);
                return Ok(profile);
            }
            catch (Exception ex)
            {
                return NotFound(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetMyProfile()
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var profile = await _service.GetProfileAsync(userId);
                return Ok(profile);
            }
            catch (Exception ex)
            {
                return NotFound(ex.Message);
            }
        }

        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> EditProfile(EditProfileDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.EditProfileAsync(userId, dto);
                return Ok("Profil azuriran");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("me/timeslots")]
        public async Task<IActionResult> GetTimeSlots()
        {
            try 
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var timeslots = await _service.GetTimeSlotsAsync(userId);
                return Ok(timeslots);
            }
            catch (Exception ex) 
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPost("me/timeslots")]
        public async Task<IActionResult> AddTimeSlot(CreateFreeTimeSlotDto dto)
        {
            try 
            {   
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.AddTimeSlotAsync(userId, dto);
                return NoContent();
            }
            catch (Exception ex) 
            {
                return BadRequest(ex.Message);
            }
        } 

        [Authorize]
        [HttpPost("me/timeslots/{timeslotId}")]
        public async Task<IActionResult> RemoveTimeSlot(int timeslotId)
        {
            try 
            {   
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.RemoveTimeSlotAsync(userId, timeslotId);
                return Ok();
            }
            catch (Exception ex) 
            {
                return BadRequest(ex.Message);
            }
        } 

        [HttpGet("interests")]
        public async Task<IActionResult> GetAllInterests()
        {
            try
            {
                var interests = await _service.GetInterestsAsync();
                return Ok(interests);
            }
            catch (Exception ex) 
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("me/interests")]
        public async Task<IActionResult> GetUserInterests()
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var interests = await _service.GetUserInterestsAsync(userId);
                return Ok(interests);
            }
            catch (Exception ex) 
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPost("me/interests/{interestId}")]
        public async Task<IActionResult> AddInterest(int interestId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.AddInterestAsync(userId, interestId); 
                return NoContent();
            }
            catch (Exception ex) 
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpDelete("me/interests/{interestId}")]
        public async Task<IActionResult> RemoveInterest(int interestId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.RemoveInterestAsync(userId, interestId); 
                return Ok();
            }
            catch (Exception ex) 
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
