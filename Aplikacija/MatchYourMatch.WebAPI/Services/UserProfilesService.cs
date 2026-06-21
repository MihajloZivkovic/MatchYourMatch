using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.User;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

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

        public async Task<UserProfileDto> EditProfileAsync(int userId, EditProfileDto dto)
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
            if (dto.FullName?.Trim().Length > 160)
                throw new Exception("Full name cannot be longer than 160 characters.");
            if (dto.DateOfBirth.HasValue && dto.DateOfBirth.Value > DateOnly.FromDateTime(DateTime.Today).AddYears(-16))
                throw new Exception("You must be at least 16 years old.");

            user.Profile.Bio = dto.Bio;
            user.Profile.ProfilePicture = dto.ProfilePicture;
            user.Profile.LocationPrivacy = NormalizeLocationPrivacy(dto.LocationPrivacy);
            user.Profile.FullName = string.IsNullOrWhiteSpace(dto.FullName) ? null : dto.FullName.Trim();
            user.Profile.ShowFullName = dto.ShowFullName;
            user.Profile.DateOfBirth = dto.DateOfBirth;
            user.Profile.ShowAge = dto.ShowAge;

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
            return await GetProfileAsync(userId);
        }

        public async Task<UserProfileDto> GetProfileAsync(int userId)
        {
            var user = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
                throw new Exception("Korisnik nije pronadjen");

            var responseRatePercent = await CalculateResponseRateAsync(userId);
            var matchesCount = await CalculateMatchesCountAsync(userId);
            var eventsJoinedCount = await CalculateEventsJoinedCountAsync(userId);
            var profileScorePercent = await CalculateProfileScoreAsync(userId);
            var followersCount = await _context.Follows.CountAsync(f => f.FollowingId == userId);
            var followingCount = await _context.Follows.CountAsync(f => f.FollowerId == userId);
            var rating = await GetRatingSummaryAsync(userId);

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
                LocationPrivacy = user.Profile?.LocationPrivacy ?? "CityOnly",
                MatchesCount = matchesCount,
                EventsJoinedCount = eventsJoinedCount,
                ProfileScorePercent = profileScorePercent,
                ResponseRatePercent = responseRatePercent,
                FollowersCount = followersCount,
                FollowingCount = followingCount,
                AverageRating = rating.Average,
                RatingsCount = rating.Count
                ,FullName = user.Profile?.FullName
                ,ShowFullName = user.Profile?.ShowFullName ?? false
                ,DateOfBirth = user.Profile?.DateOfBirth
                ,ShowAge = user.Profile?.ShowAge ?? false
                ,Age = CalculateAge(user.Profile?.DateOfBirth)
                ,LittleThings = DeserializeTags(user.Profile?.LittleThingsJson, 10)
                ,CurrentlyExploring = DeserializeTags(user.Profile?.ExploringTagsJson, 5)
            };
        }

        public async Task<UserProfileDto> UpdateProfileTagsAsync(int userId, UpdateProfileTagsDto dto)
        {
            var user = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null) throw new Exception("Korisnik nije pronadjen");

            if (user.Profile == null)
            {
                user.Profile = new UserProfile { UserId = userId };
                _context.UserProfiles.Add(user.Profile);
            }

            if (dto.LittleThings != null)
                user.Profile.LittleThingsJson = JsonSerializer.Serialize(NormalizeTags(dto.LittleThings, 10));
            if (dto.CurrentlyExploring != null)
                user.Profile.ExploringTagsJson = JsonSerializer.Serialize(NormalizeTags(dto.CurrentlyExploring, 5));

            await _context.SaveChangesAsync();
            return await GetProfileAsync(userId);
        }

        public async Task<PublicUserProfileDto> GetPublicProfileAsync(int userId, int currentUserId)
        {
            var user = await _context.Users
                .AsNoTracking()
                .Include(u => u.Profile)
                .Include(u => u.UserInterests)
                    .ThenInclude(ui => ui.Interest)
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

            if (user == null)
                throw new Exception("Korisnik nije pronadjen");

            var responseRatePercent = await CalculateResponseRateAsync(userId);
            var matchesCount = await CalculateMatchesCountAsync(userId);
            var eventsJoinedCount = await CalculateEventsJoinedCountAsync(userId);
            var profileScorePercent = await CalculateProfileScoreAsync(userId);
            var followersCount = await _context.Follows.CountAsync(f => f.FollowingId == userId);
            var followingCount = await _context.Follows.CountAsync(f => f.FollowerId == userId);
            var rating = await GetRatingSummaryAsync(userId);
            var isFollowing = await _context.Follows.AnyAsync(f =>
                f.FollowerId == currentUserId && f.FollowingId == userId);
            var canMessage = await CanMessageAsync(currentUserId, userId);

            return new PublicUserProfileDto
            {
                Id = user.Id,
                Username = user.Username,
                Bio = user.Profile?.Bio,
                ProfilePicture = user.Profile?.ProfilePicture,
                LocationDisplayName = GetPublicLocation(user.Profile),
                MatchesCount = matchesCount,
                EventsJoinedCount = eventsJoinedCount,
                ProfileScorePercent = profileScorePercent,
                ResponseRatePercent = responseRatePercent,
                IsFollowing = isFollowing,
                FollowersCount = followersCount,
                FollowingCount = followingCount,
                AverageRating = rating.Average,
                RatingsCount = rating.Count,
                FullName = user.Profile?.ShowFullName == true ? user.Profile.FullName : null,
                Age = user.Profile?.ShowAge == true ? CalculateAge(user.Profile.DateOfBirth) : null,
                LittleThings = DeserializeTags(user.Profile?.LittleThingsJson, 10),
                CurrentlyExploring = DeserializeTags(user.Profile?.ExploringTagsJson, 5),
                CanMessage = canMessage,
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

        public async Task<List<UserMatchDto>> GetMatchesAsync(int userId)
        {
            var matches = await _context.UserMatches
                .AsNoTracking()
                .Include(match => match.UserA)
                    .ThenInclude(u => u!.Profile)
                .Include(match => match.UserA)
                    .ThenInclude(u => u!.UserInterests)
                        .ThenInclude(ui => ui.Interest)
                .Include(match => match.UserB)
                    .ThenInclude(u => u!.Profile)
                .Include(match => match.UserB)
                    .ThenInclude(u => u!.UserInterests)
                        .ThenInclude(ui => ui.Interest)
                .Where(match => match.IsActive && match.Source == "QuickMatch" &&
                    (match.UserAId == userId || match.UserBId == userId))
                .OrderByDescending(match => match.CreatedAt)
                .ToListAsync();

            return matches
                .Select(match =>
                {
                    var otherUser = match.UserAId == userId ? match.UserB : match.UserA;
                    if (otherUser == null || otherUser.Id == userId || !otherUser.IsActive)
                        return null;

                    return new UserMatchDto
                    {
                        UserId = otherUser.Id,
                        Username = otherUser.Username,
                        DisplayName = otherUser.Username,
                        Initials = GetInitials(otherUser.Username),
                        ProfilePicture = otherUser.Profile?.ProfilePicture,
                        LocationDisplayName = GetPublicLocation(otherUser.Profile),
                        Bio = otherUser.Profile?.Bio,
                        MatchedAt = match.CreatedAt,
                        Source = match.Source,
                        CompatibilityScore = match.CompatibilityScore,
                        Tags = otherUser.UserInterests
                            .Where(ui => ui.Interest != null)
                            .Select(ui => ui.Interest!.Name)
                            .Where(name => !string.IsNullOrWhiteSpace(name))
                            .Distinct(StringComparer.OrdinalIgnoreCase)
                            .OrderBy(name => name)
                            .Take(4)
                            .ToList()
                    };
                })
                .Where(match => match != null)
                .Select(match => match!)
                .ToList();
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

        private async Task<int?> CalculateResponseRateAsync(int userId)
        {
            var messages = await _context.ChatMessages
                .AsNoTracking()
                .Where(message => message.SenderId == userId || message.ReceiverId == userId)
                .Select(message => new
                {
                    message.Id,
                    message.ConversationId,
                    message.SenderId,
                    message.ReceiverId,
                    message.CreatedAt
                })
                .OrderBy(message => message.ConversationId)
                .ThenBy(message => message.CreatedAt)
                .ThenBy(message => message.Id)
                .ToListAsync();

            var receivedMessages = messages
                .Where(message => message.ReceiverId == userId)
                .ToList();

            if (receivedMessages.Count == 0)
            {
                return null;
            }

            var answeredMessages = receivedMessages.Count(received =>
                messages.Any(message =>
                    message.ConversationId == received.ConversationId &&
                    message.SenderId == userId &&
                    (message.CreatedAt > received.CreatedAt ||
                     (message.CreatedAt == received.CreatedAt && message.Id > received.Id))));

            return (int)Math.Round(answeredMessages * 100.0 / receivedMessages.Count);
        }

        private async Task<int> CalculateMatchesCountAsync(int userId)
        {
            return await _context.UserMatches
                .AsNoTracking()
                .CountAsync(match => match.IsActive && match.Source == "QuickMatch" &&
                    (match.UserAId == userId || match.UserBId == userId));
        }

        private Task<int> CalculateEventsJoinedCountAsync(int userId)
        {
            return _context.EventParticipants
                .AsNoTracking()
                .CountAsync(participant => participant.UserId == userId);
        }

        private async Task<int> CalculateProfileScoreAsync(int userId)
        {
            var summary = await GetRatingSummaryAsync(userId);
            return summary.Average.HasValue
                ? (int)Math.Round(summary.Average.Value / 5m * 100m, MidpointRounding.AwayFromZero)
                : 0;
        }

        private async Task<(decimal? Average, int Count)> GetRatingSummaryAsync(int userId)
        {
            var ratings = _context.UserRatings.AsNoTracking().Where(rating => rating.RatedUserId == userId);
            var count = await ratings.CountAsync();
            var average = count == 0 ? (decimal?)null : await ratings.AverageAsync(rating => rating.Rating);
            return (average.HasValue ? decimal.Round(average.Value, 1) : null, count);
        }

        private static bool IsDeepMatchPreferenceComplete(UserDeepMatchPreference? preference)
        {
            return preference != null &&
                   !string.IsNullOrWhiteSpace(preference.RelationshipValue) &&
                   !string.IsNullOrWhiteSpace(preference.CommunicationStyle) &&
                   !string.IsNullOrWhiteSpace(preference.FreeTimePreference) &&
                   !string.IsNullOrWhiteSpace(preference.SocialEnergy) &&
                   !string.IsNullOrWhiteSpace(preference.RelationshipPace);
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

        private static string GetInitials(string? username)
        {
            if (string.IsNullOrWhiteSpace(username))
                return "MY";

            var parts = username
                .Split(new[] { '.', '_', '-', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Take(2)
                .Select(part => char.ToUpperInvariant(part[0]).ToString());

            var initials = string.Join("", parts);
            return string.IsNullOrWhiteSpace(initials) ? "MY" : initials;
        }

        private static int? CalculateAge(DateOnly? dateOfBirth)
        {
            if (!dateOfBirth.HasValue) return null;
            var today = DateOnly.FromDateTime(DateTime.Today);
            var age = today.Year - dateOfBirth.Value.Year;
            if (dateOfBirth.Value > today.AddYears(-age)) age--;
            return age is >= 0 and <= 120 ? age : null;
        }

        private static List<string> NormalizeTags(IEnumerable<string>? tags, int maxTags)
        {
            var normalized = (tags ?? Enumerable.Empty<string>())
                .Select(tag => tag?.Trim())
                .Where(tag => !string.IsNullOrWhiteSpace(tag))
                .Select(tag => tag!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (normalized.Any(tag => tag.Length > 60))
                throw new Exception("Tags cannot be longer than 60 characters.");
            if (normalized.Count > maxTags)
                throw new Exception($"You can add up to {maxTags} tags.");

            return normalized;
        }

        private static List<string> DeserializeTags(string? json, int maxTags)
        {
            if (string.IsNullOrWhiteSpace(json)) return new List<string>();
            try { return NormalizeTags(JsonSerializer.Deserialize<List<string>>(json), maxTags); }
            catch { return new List<string>(); }
        }

        private async Task<bool> CanMessageAsync(int senderId, int receiverId)
        {
            if (await _context.BlockedUsers.AnyAsync(x =>
                (x.BlockerUserId == senderId && x.BlockedUserId == receiverId) ||
                (x.BlockerUserId == receiverId && x.BlockedUserId == senderId))) return false;
            var policy = await _context.UserAppSettings.Where(x => x.UserId == receiverId)
                .Select(x => x.WhoCanMessageMe).FirstOrDefaultAsync() ?? "MatchesOnly";
            if (policy == "Everyone") return true;
            if (policy == "PeopleIFollow") return await _context.Follows.AnyAsync(x => x.FollowerId == receiverId && x.FollowingId == senderId);
            if (policy == "Followers") return await _context.Follows.AnyAsync(x => x.FollowerId == senderId && x.FollowingId == receiverId);
            return await _context.UserMatches.AnyAsync(x => x.IsActive && x.Source == "QuickMatch" &&
                ((x.UserAId == senderId && x.UserBId == receiverId) || (x.UserBId == senderId && x.UserAId == receiverId)));
        }
    }
}
