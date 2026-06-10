using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.User;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class UserProfilesService : IUserProfilesService
    {
        private readonly AppDbContext _context;

        public UserProfilesService(AppDbContext context)
        {
            _context = context;
        }

        public async Task EditProfileAsync(int userId, EditProfileDto dto)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new Exception("Korisnik nije pronadjen");

            if (user.Profile == null)
            {
                user.Profile = new UserProfile { UserId = userId };
                _context.UserProfiles.Add(user.Profile);
            }

            var displayLocation = NormalizeApproximateLocation(
                dto.LocationDisplayName ?? dto.Location);
            var parsedLocation = ParseLocation(displayLocation);

            user.Profile.Bio = dto.Bio;
            user.Profile.ProfilePicture = dto.ProfilePicture;
            user.Profile.Location = displayLocation;
            user.Profile.LocationDisplayName = displayLocation;
            user.Profile.LocationCity = parsedLocation.City;
            user.Profile.LocationCountry = parsedLocation.Country;
            user.Profile.Latitude = IsValidLatitude(dto.Latitude) ? dto.Latitude : null;
            user.Profile.Longitude = IsValidLongitude(dto.Longitude) ? dto.Longitude : null;
            user.Profile.LocationPrivacy = NormalizeLocationPrivacy(dto.LocationPrivacy);

            await _context.SaveChangesAsync();
        }

        public async Task<UserProfileDto> GetProfileAsync(int userId)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new Exception("Korisnik nije pronadjen");

            return new UserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Email = user.Email,
                Bio = user.Profile?.Bio,
                ProfilePicture = user.Profile?.ProfilePicture,
                Location = GetPublicLocation(user.Profile),
                LocationDisplayName = GetPublicLocation(user.Profile),
                LocationPrivacy = user.Profile?.LocationPrivacy ?? "CityOnly"
            };
        }

        public async Task<PublicUserProfileDto> GetPublicProfileAsync(int userId)
        {
            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.Profile)
                .Include(u => u.UserInterests)
                    .ThenInclude(ui => ui.Interest)
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

            if (user == null)
                throw new Exception("Korisnik nije pronadjen");

            return new PublicUserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Bio = user.Profile?.Bio,
                ProfilePicture = user.Profile?.ProfilePicture,
                LocationDisplayName = GetPublicLocation(user.Profile),
                Interests = user.UserInterests
                    .Where(ui => ui.Interest != null)
                    .Select(ui => new InterestDto
                    {
                        Id = ui.Interest!.Id,
                        Name = ui.Interest.Name,
                        Category = ui.Interest.Category
                    })
                    .OrderBy(i => i.Name)
                    .ToList()
            };
        }

        public async Task<List<FreeTimeSlotDto>> GetTimeSlotsAsync(int userId)
        {
            return await _context.FreeTimeSlots
                .Where(s => s.UserId == userId)
                .Select(s => new FreeTimeSlotDto
                {
                    Id = s.Id,
                    DayOfWeek = s.DayOfWeek,
                    StartTime = s.StartTime,
                    EndTime = s.EndTime
                })
                .ToListAsync();
        }

        public async Task AddTimeSlotAsync(int userId, CreateFreeTimeSlotDto dto)
        {
            var timeslot = new FreeTimeSlot
            {
                UserId = userId,
                DayOfWeek = dto.DayOfWeek,
                StartTime = dto.StartTime,
                EndTime = dto.EndTime
            };

            _context.FreeTimeSlots.Add(timeslot);
            await _context.SaveChangesAsync();
        }

        public async Task RemoveTimeSlotAsync(int userId, int timeslotId)
        {
            var timeslot = await _context.FreeTimeSlots
                .FirstOrDefaultAsync(s => s.Id == timeslotId && s.UserId == userId);
            if (timeslot == null)
                throw new Exception("Timeslot ne postoji.");
            
            _context.FreeTimeSlots.Remove(timeslot);
            await _context.SaveChangesAsync();
        }

        public async Task<List<FreeTimeSlotDto>> UpdateAvailabilityAsync(
            int userId,
            UpdateAvailabilityDto dto)
        {
            foreach (var slot in dto.Slots)
            {
                ValidateTimeSlot(slot);
            }

            var current = await _context.FreeTimeSlots
                .Where(s => s.UserId == userId)
                .ToListAsync();

            _context.FreeTimeSlots.RemoveRange(current);

            _context.FreeTimeSlots.AddRange(dto.Slots.Select(slot => new FreeTimeSlot
            {
                UserId = userId,
                DayOfWeek = slot.DayOfWeek,
                StartTime = slot.StartTime,
                EndTime = slot.EndTime
            }));

            await _context.SaveChangesAsync();

            return await GetTimeSlotsAsync(userId);
        }

        public async Task<DeepMatchPreferenceDto> GetDeepMatchPreferenceAsync(int userId)
        {
            var preference = await _context.UserDeepMatchPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId);

            return MapPreference(preference);
        }

        public async Task<DeepMatchPreferenceDto> UpdateDeepMatchPreferenceAsync(
            int userId,
            DeepMatchPreferenceDto dto)
        {
            var preference = await _context.UserDeepMatchPreferences
                .FirstOrDefaultAsync(p => p.UserId == userId);

            if (preference == null)
            {
                preference = new UserDeepMatchPreference
                {
                    UserId = userId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.UserDeepMatchPreferences.Add(preference);
            }

            preference.RelationshipValue = dto.RelationshipValue;
            preference.CommunicationStyle = dto.CommunicationStyle;
            preference.FreeTimePreference = dto.FreeTimePreference;
            preference.SocialEnergy = dto.SocialEnergy;
            preference.RelationshipPace = dto.RelationshipPace;
            preference.ImportantValues = dto.ImportantValues;
            preference.LifestylePreferences = dto.LifestylePreferences;
            preference.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return MapPreference(preference);
        }

        public async Task<List<InterestDto>> GetInterestsAsync()
        {
            return await _context.Interests
                .Select(i => new InterestDto
                {
                    Id = i.Id,
                    Name = i.Name,
                    Category = i.Category
                })
                .ToListAsync();
        }

        public async Task<List<InterestDto>> GetUserInterestsAsync(int userId)
        {
            return await _context.UserInterests
                .Where(u => u.UserId == userId)
                .Select(u => new InterestDto
                {
                    Id = u.Interest!.Id,
                    Name = u.Interest.Name,
                    Category = u.Interest.Category
                })
                .ToListAsync();
        }

        public async Task AddInterestAsync(int userId, int interestId)
        {
            var added = await _context.UserInterests
                .AnyAsync(u => u.UserId == userId && u.InterestId == interestId);
            if (added)
                return;
            _context.UserInterests.Add(new UserInterest
            {
                UserId = userId,
                InterestId = interestId
            });
            await _context.SaveChangesAsync();
        }

        public async Task RemoveInterestAsync(int userId, int interestId)
        {
            var interest = await _context.UserInterests
                .FirstOrDefaultAsync(u => u.UserId == userId && u.InterestId == interestId);
            if (interest == null)
                return;
            _context.UserInterests.Remove(interest);
            await _context.SaveChangesAsync();
        }

        private static void ValidateTimeSlot(CreateFreeTimeSlotDto dto)
        {
            if (dto.DayOfWeek < 0 || dto.DayOfWeek > 6)
                throw new Exception("Day of week must be between 0 and 6.");

            if (dto.StartTime >= dto.EndTime)
                throw new Exception("Start time must be before end time.");
        }

        private static DeepMatchPreferenceDto MapPreference(UserDeepMatchPreference? preference)
        {
            var dto = new DeepMatchPreferenceDto
            {
                RelationshipValue = preference?.RelationshipValue,
                CommunicationStyle = preference?.CommunicationStyle,
                FreeTimePreference = preference?.FreeTimePreference,
                SocialEnergy = preference?.SocialEnergy,
                RelationshipPace = preference?.RelationshipPace,
                ImportantValues = preference?.ImportantValues,
                LifestylePreferences = preference?.LifestylePreferences
            };

            dto.IsComplete =
                !string.IsNullOrWhiteSpace(dto.RelationshipValue) &&
                !string.IsNullOrWhiteSpace(dto.CommunicationStyle) &&
                !string.IsNullOrWhiteSpace(dto.FreeTimePreference) &&
                !string.IsNullOrWhiteSpace(dto.SocialEnergy) &&
                !string.IsNullOrWhiteSpace(dto.RelationshipPace);

            return dto;
        }

        private static string? NormalizeApproximateLocation(string? location)
        {
            if (string.IsNullOrWhiteSpace(location))
                return null;

            var parts = location
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .ToList();

            if (parts.Count == 0)
                return null;

            if (parts.Count == 1)
                return parts[0];

            if (parts.Count == 2)
                return $"{parts[0]}, {parts[1]}";

            return $"{parts[^2]}, {parts[^1]}";
        }

        private static (string? City, string? Country) ParseLocation(string? location)
        {
            if (string.IsNullOrWhiteSpace(location))
                return (null, null);

            var parts = location
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .ToList();

            if (parts.Count == 0)
                return (null, null);

            if (parts.Count == 1)
                return (parts[0], null);

            return (parts[0], parts[^1]);
        }

        private static string NormalizeLocationPrivacy(string? privacy)
        {
            return privacy is "Hidden" or "CityOnly" ? privacy : "CityOnly";
        }

        private static bool IsValidLatitude(double? latitude)
        {
            return latitude is >= -90 and <= 90;
        }

        private static bool IsValidLongitude(double? longitude)
        {
            return longitude is >= -180 and <= 180;
        }

        private static string? GetPublicLocation(UserProfile? profile)
        {
            if (profile == null)
                return null;

            if (profile.LocationPrivacy == "Hidden")
                return "Location hidden";

            return profile.LocationDisplayName ?? profile.Location;
        }
    }
}
