using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Activity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ActivitiesController : ControllerBase
    {
        private readonly AppDbContext _context;

        public ActivitiesController(AppDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetActivities()
        {
            var activities = await _context.Activities
                .Include(a => a.ActivityCategory)
                .OrderBy(a => a.ActivityCategory.DisplayName)
                .ThenBy(a => a.DisplayName)
                .Select(a => new ActivityDto
                {
                    Id = a.Id,
                    Name = a.Name,
                    DisplayName = a.DisplayName,
                    ActivityCategoryId = a.ActivityCategoryId,
                    ActivityCategoryName = a.ActivityCategory.DisplayName
                })
                .ToListAsync();

            return Ok(activities);
        }
    }
}
