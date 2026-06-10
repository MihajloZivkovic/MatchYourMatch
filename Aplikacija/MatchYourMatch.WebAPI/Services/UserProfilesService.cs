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
        private readonly IGeocodingService _geocodingService;

        public UserProfilesService(AppDbContext context, IGeocodingService geocodingService)
        {
            _context = context;
            _geocodingService = geocodingService;
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

            var locationInput = NormalizeLocationInput(dto.Location ?? dto.LocationDisplayName);

            user.Profile.Bio = dto.Bio;
            user.Profile.ProfilePicture = dto.ProfilePicture;
            user.Profile.LocationPrivacy = NormalizeLocationPrivacy(dto.LocationPrivacy);

            if (string.IsNullOrWhiteSpace(locationInput))
            {
                user.Profile.Location = null;
                user.Profile.LocationRawInput = null;
                user.Profile.LocationDisplayName = null;
                user.Profile.LocationCity = null;
                user.Profile.LocationCountry = null;
                user.Profile.Latitude = null;
                user.Profile.Longitude = null;
            }
            else if (!IsSameLocationInput(user.Profile.LocationRawInput ?? user.Profile.Location, locationInput) ||
                     !HasCoordinates(user.Profile) ||
                     string.IsNullOrWhiteSpace(user.Profile.LocationDisplayName))
            {
                var geocodedLocation = await _geocodingService.GeocodeAsync(locationInput);

                if (geocodedLocation == null)
                    throw new Exception("We couldn't find that location. Try entering city and country.");

                user.Profile.LocationRawInput = locationInput;
                user.Profile.Location = geocodedLocation.DisplayName;
                user.Profile.LocationDisplayName = geocodedLocation.DisplayName;
                user.Profile.LocationCity = geocodedLocation.City;
                user.Profile.LocationCountry = geocodedLocation.Country;
                user.Profile.Latitude = geocodedLocation.Latitude;
                user.Profile.Longitude = geocodedLocation.Longitude;
            }
            else
            {
                user.Profile.LocationRawInput = locationInput;
            }

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
                LocationRawInput = user.Profile?.LocationRawInput ?? user.Profile?.Location,
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

        private static string? NormalizeLocationInput(string? location)
        {
            if (string.IsNullOrWhiteSpace(location))
                return null;

            return location.Trim();
        }

        private static bool IsSameLocationInput(string? currentLocation, string locationInput)
        {
            return string.Equals(
                currentLocation?.Trim(),
                locationInput.Trim(),
                StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeLocationPrivacy(string? privacy)
        {
            return privacy is "Hidden" or "CityOnly" ? privacy : "CityOnly";
        }

        private static bool HasCoordinates(UserProfile profile)
        {
            return profile.Latitude is >= -90 and <= 90 &&
                   profile.Longitude is >= -180 and <= 180;
        }

        private static string? GetPublicLocation(UserProfile? profile)
        {
            if (profile == null)
                return null;

            if (profile.LocationPrivacy == "Hidden")
                return "Location hidden";

            if (!string.IsNullOrWhiteSpace(profile.LocationDisplayName))
                return profile.LocationDisplayName;

            var parts = new[] { profile.LocationCity, profile.LocationCountry }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .ToList();

            return parts.Count > 0 ? string.Join(", ", parts) : null;
        }
    }
}
