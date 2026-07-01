using System.Security.Claims;
using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Common;
using MatchYourMatch.WebAPI.DTOs.Report;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController, Route("api/[controller]"), Authorize]
    public class ReportsController : ControllerBase
    {
        private static readonly HashSet<string> AllowedReasons = new(StringComparer.OrdinalIgnoreCase)
        {
            "Harassment",
            "Spam",
            "Fake profile",
            "Inappropriate content",
            "Hate speech",
            "Other"
        };

        private readonly AppDbContext _context;
        private readonly INotificationService _notifications;

        public ReportsController(AppDbContext context, INotificationService notifications)
        {
            _context = context;
            _notifications = notifications;
        }

        [HttpPost]
        public async Task<IActionResult> Create(CreateUserReportDto request)
        {
            var reporterId = CurrentUserId();
            var reason = request.Reason?.Trim() ?? string.Empty;
            var details = request.Details?.Trim();

            if (request.ReportedUserId <= 0)
                return BadRequest(new { message = "Reported user is required." });
            if (request.ReportedUserId == reporterId)
                return BadRequest(new { message = "You cannot report yourself." });
            if (!AllowedReasons.Contains(reason))
                return BadRequest(new { message = "Choose a valid report reason." });
            if (details?.Length > 2000)
                return BadRequest(new { message = "Report details cannot be longer than 2000 characters." });
            if (reason.Equals("Other", StringComparison.OrdinalIgnoreCase) && string.IsNullOrWhiteSpace(details))
                return BadRequest(new { message = "Please add details for this report reason." });

            var reportedExists = await _context.Users.AsNoTracking()
                .AnyAsync(user => user.Id == request.ReportedUserId && user.IsActive);
            if (!reportedExists)
                return NotFound(new { message = "Reported user could not be found." });

            var report = new UserReport
            {
                ReporterUserId = reporterId,
                ReportedUserId = request.ReportedUserId,
                Reason = NormalizeReason(reason),
                Details = string.IsNullOrWhiteSpace(details) ? null : details,
                Status = "Pending",
                CreatedAt = DateTime.UtcNow
            };
            _context.UserReports.Add(report);
            await _context.SaveChangesAsync();

            var adminIds = await _context.Users.AsNoTracking()
                .Where(user => user.IsActive &&
                    (user.Role == "Admin" || user.Role == "Administrator"))
                .Select(user => user.Id)
                .ToListAsync();

            foreach (var adminId in adminIds)
            {
                await _notifications.CreateNotificationAsync(
                    adminId,
                    null,
                    "AdminReport",
                    "New user report",
                    $"A new {report.Reason} report needs review.",
                    "UserReport",
                    report.Id);
            }

            return Ok(new { success = true, message = "Report submitted." });
        }

        [HttpGet("my-history")]
        public async Task<ActionResult<PagedResultDto<UserReportHistoryDto>>> MyHistory([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            var reporterId = CurrentUserId();
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 50);

            var query = _context.UserReports.AsNoTracking()
                .Where(report => report.ReporterUserId == reporterId)
                .OrderByDescending(report => report.CreatedAt)
                .Select(report => new UserReportHistoryDto
                {
                    Id = report.Id,
                    ReportedUserId = report.ReportedUserId,
                    ReportedUsername = report.ReportedUser != null ? report.ReportedUser.Username : "unknown",
                    ReportedDisplayName = report.ReportedUser != null && report.ReportedUser.Profile != null
                        ? report.ReportedUser.Profile.FullName
                        : null,
                    Reason = report.Reason,
                    Details = report.Details,
                    Status = report.Status,
                    CreatedAt = report.CreatedAt
                });

            var totalCount = await query.CountAsync();
            var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            return Ok(new PagedResultDto<UserReportHistoryDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalCount == 0 ? 1 : (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("admin")]
        public async Task<ActionResult<PagedResultDto<AdminUserReportDto>>> AdminList(
            [FromQuery] string? status,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 20)
        {
            page = Math.Max(1, page);
            pageSize = Math.Clamp(pageSize, 1, 100);
            var normalizedStatus = status?.Trim();

            var query = _context.UserReports.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(normalizedStatus) &&
                !normalizedStatus.Equals("All", StringComparison.OrdinalIgnoreCase))
            {
                query = query.Where(report => report.Status == normalizedStatus);
            }

            var projected = query
                .OrderByDescending(report => report.CreatedAt)
                .Select(report => new AdminUserReportDto
                {
                    Id = report.Id,
                    ReporterUserId = report.ReporterUserId,
                    ReporterUsername = report.ReporterUser != null ? report.ReporterUser.Username : "unknown",
                    ReporterDisplayName = report.ReporterUser != null && report.ReporterUser.Profile != null
                        ? report.ReporterUser.Profile.FullName
                        : null,
                    ReportedUserId = report.ReportedUserId,
                    ReportedUsername = report.ReportedUser != null ? report.ReportedUser.Username : "unknown",
                    ReportedDisplayName = report.ReportedUser != null && report.ReportedUser.Profile != null
                        ? report.ReportedUser.Profile.FullName
                        : null,
                    Reason = report.Reason,
                    Details = report.Details,
                    Status = report.Status,
                    CreatedAt = report.CreatedAt,
                    ReviewedAt = report.ReviewedAt,
                    ReviewedByUserId = report.ReviewedByUserId,
                    ReviewedByUsername = report.ReviewedByUser != null ? report.ReviewedByUser.Username : null,
                    ReportedUserLifetimeReportCount = _context.UserReports.Count(r => r.ReportedUserId == report.ReportedUserId)
                });

            var totalCount = await projected.CountAsync();
            var items = await projected.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync();

            return Ok(new PagedResultDto<AdminUserReportDto>
            {
                Items = items,
                Page = page,
                PageSize = pageSize,
                TotalCount = totalCount,
                TotalPages = totalCount == 0 ? 1 : (int)Math.Ceiling(totalCount / (double)pageSize)
            });
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("admin/{id:int}/status")]
        public async Task<IActionResult> UpdateStatus(int id, UpdateUserReportStatusDto request)
        {
            var normalizedStatus = NormalizeAdminReportStatus(request.Status);
            if (normalizedStatus == null)
                return BadRequest(new { message = "Choose a valid report status." });

            var report = await _context.UserReports.FindAsync(id);
            if (report == null)
                return NotFound(new { message = "Report could not be found." });

            report.Status = normalizedStatus;
            report.ReviewedAt = DateTime.UtcNow;
            report.ReviewedByUserId = CurrentUserId();
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private int CurrentUserId() => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        private static string NormalizeReason(string reason) => AllowedReasons.First(value =>
            value.Equals(reason, StringComparison.OrdinalIgnoreCase));

        private static string? NormalizeAdminReportStatus(string? status)
        {
            if (status == null) return null;
            if (status.Equals("Reviewed", StringComparison.OrdinalIgnoreCase)) return "Reviewed";
            if (status.Equals("Dismissed", StringComparison.OrdinalIgnoreCase)) return "Dismissed";
            if (status.Equals("Action taken", StringComparison.OrdinalIgnoreCase)) return "Action taken";
            return null;
        }
    }
}
