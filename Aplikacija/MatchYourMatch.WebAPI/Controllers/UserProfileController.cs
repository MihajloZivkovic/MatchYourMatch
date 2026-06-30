using MatchYourMatch.WebAPI.DTOs.User;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.Models;
using Microsoft.EntityFrameworkCore;
using System.Text;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class UserProfileController: ControllerBase
    {
        private readonly IUserProfilesService _service;
        private readonly IGeocodingService _geocodingService;
        private readonly AppDbContext _context;
        private readonly IWebHostEnvironment _environment;

        private const long MaxProfileImageSize = 5 * 1024 * 1024;
        private static readonly HashSet<string> AllowedProfileImageExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".jpg", ".jpeg", ".png", ".webp"
        };

        public UserProfileController(
            IUserProfilesService service,
            IGeocodingService geocodingService,
            AppDbContext context,
            IWebHostEnvironment environment)
        {
            _service = service;
            _geocodingService = geocodingService;
            _context = context;
            _environment = environment;
        }

        [Authorize]
        [HttpGet("{id}")]
        public async Task<IActionResult> GetProfile(int id)
        {
            try
            {
                var currentUserId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);

                if (id != currentUserId)
                    return Forbid();

                var profile = await _service.GetProfileAsync(id);
                return Ok(profile);
            }
            catch (Exception ex)
            {
                return NotFound(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("public/{id}")]
        public async Task<IActionResult> GetPublicProfile(int id)
        {
            try
            {
                var currentUserId = TryGetCurrentUserId();
                if (IsOrganizer() && !await IsOrganizerProfileAsync(id))
                {
                    return Forbid();
                }
                if (IsGuest() && !await IsOrganizerProfileAsync(id))
                {
                    return Forbid();
                }

                var profile = await _service.GetPublicProfileAsync(id, currentUserId);
                return Ok(profile);
            }
            catch (Exception ex)
            {
                return NotFound(ex.Message);
            }
        }

        private bool IsOrganizer()
        {
            var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? string.Empty;
            return role.Equals("Organizer", StringComparison.OrdinalIgnoreCase) ||
                   role.Equals("EventOrganizer", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsGuest()
        {
            var role = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role") ?? string.Empty;
            return role.Equals("Guest", StringComparison.OrdinalIgnoreCase);
        }

        private int TryGetCurrentUserId()
        {
            var value = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            return int.TryParse(value, out var userId) ? userId : 0;
        }

        private async Task<bool> IsOrganizerProfileAsync(int userId)
        {
            var role = await _context.Users
                .AsNoTracking()
                .Where(user => user.Id == userId)
                .Select(user => user.Role)
                .FirstOrDefaultAsync();

            return role != null &&
                   (role.Equals("Organizer", StringComparison.OrdinalIgnoreCase) ||
                    role.Equals("EventOrganizer", StringComparison.OrdinalIgnoreCase));
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
        [HttpGet("me/matches")]
        public async Task<IActionResult> GetMyMatches()
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var matches = await _service.GetMatchesAsync(userId);
                return Ok(matches);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> EditProfile(EditProfileDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var profile = await _service.EditProfileAsync(userId, dto);
                return Ok(profile);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPost("me/profile-picture")]
        [RequestSizeLimit(MaxProfileImageSize + 64 * 1024)]
        public async Task<IActionResult> UploadProfilePicture([FromForm] IFormFile file, CancellationToken cancellationToken)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var profilePictureUrl = await SaveProfilePictureAsync(userId, file, cancellationToken);
                var profile = await _service.GetProfileAsync(userId);
                profile.ProfilePicture = profilePictureUrl;
                return Ok(profile);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpGet("{id:int}/profile-picture")]
        public async Task<IActionResult> GetProfilePicture(int id, CancellationToken cancellationToken)
        {
            var profile = await _context.UserProfiles
                .AsNoTracking()
                .Where(p => p.UserId == id)
                .Select(p => new
                {
                    p.ProfilePicture,
                    p.ProfilePictureContent,
                    p.ProfilePictureContentType,
                    p.ProfilePictureFileName
                })
                .FirstOrDefaultAsync(cancellationToken);

            if (profile == null)
                return NotFound();

            if (profile.ProfilePictureContent is { Length: > 0 })
            {
                return File(
                    profile.ProfilePictureContent,
                    profile.ProfilePictureContentType ?? "application/octet-stream",
                    profile.ProfilePictureFileName,
                    enableRangeProcessing: true);
            }

            var oldLocalStream = TryOpenOldLocalProfileImage(profile.ProfilePicture, out var oldContentType, out var oldFileName);
            if (oldLocalStream != null)
                return File(oldLocalStream, oldContentType, oldFileName, enableRangeProcessing: true);

            return NotFound();
        }

        [Authorize]
        [HttpPut("me/tags")]
        public async Task<IActionResult> UpdateProfileTags(UpdateProfileTagsDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                return Ok(await _service.UpdateProfileTagsAsync(userId, dto));
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPut("me/lifestyle")]
        public async Task<IActionResult> UpdateProfileLifestyle(UpdateProfileLifestyleDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                return Ok(await _service.UpdateProfileLifestyleAsync(userId, dto));
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("location-suggestions")]
        public async Task<IActionResult> GetLocationSuggestions([FromQuery] string? query)
        {
            var trimmedQuery = query?.Trim() ?? string.Empty;

            if (trimmedQuery.Length < 3)
                return Ok(new List<LocationSuggestionDto>());

            var suggestions = await _geocodingService.SearchAsync(trimmedQuery, 5);

            return Ok(suggestions.Select(suggestion => new LocationSuggestionDto
            {
                LocationInput = suggestion.LocationInput,
                DisplayName = suggestion.DisplayName,
                City = suggestion.City,
                Country = suggestion.Country
            }));
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
        [HttpDelete("me/timeslots/{timeslotId}")]
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

        [Authorize]
        [HttpGet("me/availability")]
        public async Task<IActionResult> GetAvailability()
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
        [HttpPut("me/availability")]
        public async Task<IActionResult> UpdateAvailability(UpdateAvailabilityDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var timeslots = await _service.UpdateAvailabilityAsync(userId, dto);
                return Ok(timeslots);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpGet("me/deep-preferences")]
        public async Task<IActionResult> GetDeepMatchPreferences()
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var preferences = await _service.GetDeepMatchPreferenceAsync(userId);
                return Ok(preferences);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPut("me/deep-preferences")]
        public async Task<IActionResult> UpdateDeepMatchPreferences(DeepMatchPreferenceDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                var preferences = await _service.UpdateDeepMatchPreferenceAsync(userId, dto);
                return Ok(preferences);
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

        private async Task<string> SaveProfilePictureAsync(int userId, IFormFile file, CancellationToken cancellationToken)
        {
            if (file == null || file.Length == 0)
                throw new InvalidOperationException("Choose a non-empty image file.");
            if (file.Length > MaxProfileImageSize)
                throw new InvalidOperationException("Profile image must be 5 MB or smaller.");

            var originalName = Path.GetFileName(file.FileName).Trim();
            var extension = Path.GetExtension(originalName).ToLowerInvariant();
            if (string.IsNullOrWhiteSpace(originalName) || !AllowedProfileImageExtensions.Contains(extension))
                throw new InvalidOperationException("Only JPG, JPEG, PNG and WEBP images are allowed.");

            await using var source = file.OpenReadStream();
            var contentType = await ValidateProfileImageContentAsync(source, extension, cancellationToken);
            source.Position = 0;
            using var content = new MemoryStream((int)file.Length);
            await source.CopyToAsync(content, cancellationToken);

            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken)
                ?? throw new InvalidOperationException("User does not exist.");

            if (user.Profile == null)
            {
                user.Profile = new UserProfile { UserId = userId };
                _context.UserProfiles.Add(user.Profile);
            }

            var publicUrl = $"/api/UserProfile/{userId}/profile-picture";
            user.Profile.ProfilePicture = publicUrl;
            user.Profile.ProfilePictureContent = content.ToArray();
            user.Profile.ProfilePictureContentType = contentType;
            user.Profile.ProfilePictureFileName = originalName;
            user.Profile.ProfilePictureUpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            return publicUrl;
        }

        private static string ResolveProfileImagePath(string uploadsRoot, string relativePath)
        {
            var fullPath = Path.GetFullPath(Path.Combine(uploadsRoot, relativePath));
            if (!fullPath.StartsWith(uploadsRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Invalid image path.");
            return fullPath;
        }

        private async Task<string> ValidateProfileImageContentAsync(Stream stream, string extension, CancellationToken cancellationToken)
        {
            var header = new byte[Math.Min(32, (int)stream.Length)];
            var read = await stream.ReadAsync(header.AsMemory(0, header.Length), cancellationToken);
            stream.Position = 0;

            bool Starts(params byte[] bytes) => read >= bytes.Length && header.AsSpan(0, bytes.Length).SequenceEqual(bytes);
            var contentType = extension switch
            {
                ".jpg" or ".jpeg" when Starts(0xFF, 0xD8, 0xFF) => "image/jpeg",
                ".png" when Starts(0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A) => "image/png",
                ".webp" when read >= 12 &&
                    Encoding.ASCII.GetString(header, 0, 4) == "RIFF" &&
                    Encoding.ASCII.GetString(header, 8, 4) == "WEBP" => "image/webp",
                _ => null
            };

            if (contentType == null)
                throw new InvalidOperationException("The image content does not match its file type.");

            return contentType;
        }

        private Stream? TryOpenOldLocalProfileImage(string? profilePicture, out string contentType, out string fileName)
        {
            contentType = "application/octet-stream";
            fileName = "profile-picture";

            if (string.IsNullOrWhiteSpace(profilePicture) ||
                !profilePicture.StartsWith("/uploads/profile-images/", StringComparison.OrdinalIgnoreCase))
                return null;

            var uploadsRoot = Path.GetFullPath(Path.Combine(_environment.WebRootPath ?? Path.Combine(_environment.ContentRootPath, "wwwroot"), "uploads", "profile-images"));
            var relativePath = profilePicture["/uploads/profile-images/".Length..].Split('?', '#')[0];
            var oldPath = ResolveProfileImagePath(uploadsRoot, relativePath);
            if (!System.IO.File.Exists(oldPath))
                return null;

            fileName = Path.GetFileName(oldPath);
            contentType = Path.GetExtension(oldPath).ToLowerInvariant() switch
            {
                ".jpg" or ".jpeg" => "image/jpeg",
                ".png" => "image/png",
                ".webp" => "image/webp",
                _ => "application/octet-stream"
            };
            return new FileStream(oldPath, FileMode.Open, FileAccess.Read, FileShare.Read, 81920, true);
        }
    }
}
