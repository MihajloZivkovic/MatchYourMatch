using MatchYourMatch.WebAPI.DTOs.Event;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class EventController: ControllerBase
    {
        private readonly IEventService _service;

        public EventController(IEventService service)
        {
            _service = service;
        }

        [Authorize]
        [HttpGet]
        public async Task<IActionResult> GetEvents([FromQuery] string? category)
        {
            try
            {
                var events = await _service.GetByQueryAsync(category);
                return Ok(events);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var e = await _service.GetByIdAsync(id);
                return Ok(e);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "Organizer")]
        [HttpPost]
        public async Task<IActionResult> Create(CreateEventDto dto)
        {
            try
            {
                var organizerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var e = await _service.CreateAsync(organizerId, dto);
                return Ok(e);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "Organizer")]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, CreateEventDto dto)
        {
            try
            {
                var organizerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.UpdateAsync(organizerId, id, dto);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "Organizer")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var organizerId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _service.DeleteAsync(organizerId, id);
                return NoContent();
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
