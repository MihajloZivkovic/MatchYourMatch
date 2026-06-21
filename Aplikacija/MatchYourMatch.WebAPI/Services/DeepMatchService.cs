using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Match;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class DeepMatchService : IDeepMatchService
    {
        private readonly AppDbContext _context;

        private const int MaxRawScore = 170;

        public DeepMatchService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<DeepMatchDto>> GetMatchesAsync(int userId)
        {
            var currentUser = await _context.Users
                .Include(u => u.Profile)
                .Include(u => u.AppSettings)
                .Include(u => u.DeepMatchPreference)
                .Include(u => u.FreeTimeSlots)
                .Include(u => u.UserInterests)
                    .ThenInclude(ui => ui.Interest)
                .Include(u => u.QuickMatchPosts)
                    .ThenInclude(p => p.Activity)
                .FirstOrDefaultAsync(u => u.Id == userId);

            if (currentUser == null)
                throw new Exception("User does not exist.");

            var candidates = await _context.Users
                .Include(u => u.Profile)
                .Include(u => u.AppSettings)
                .Include(u => u.DeepMatchPreference)
                .Include(u => u.FreeTimeSlots)
                .Include(u => u.UserInterests)
                    .ThenInclude(ui => ui.Interest)
                .Include(u => u.QuickMatchPosts)
                    .ThenInclude(p => p.Activity)
                .Where(u => u.Id != userId && u.IsActive &&
                    (u.AppSettings == null || u.AppSettings.ShowMeInDeepMatch))
                .ToListAsync();

            var excludedIds = await _context.BlockedUsers
                .Where(x => x.BlockerUserId == userId || x.BlockedUserId == userId)
                .Select(x => x.BlockerUserId == userId ? x.BlockedUserId : x.BlockerUserId)
                .Concat(_context.HiddenProfiles.Where(x => x.UserId == userId).Select(x => x.HiddenUserId))
                .Distinct().ToListAsync();

            return candidates
                .Where(candidate => !excludedIds.Contains(candidate.Id) && IsEligibleBySettings(currentUser, candidate))
                .Select(candidate => ScoreCandidate(currentUser, candidate))
                .Where(match => match.CompatibilityScore > 0)
                .OrderByDescending(match => match.CompatibilityScore)
                .ThenBy(match => match.Username)
                .ToList();
        }

        private DeepMatchDto ScoreCandidate(User currentUser, User candidate)
        {
            var score = 0;
            var reasons = new List<string>();

            var currentAge = CalculateAge(currentUser.Profile?.DateOfBirth);
            var candidateAge = CalculateAge(candidate.Profile?.DateOfBirth);
            if (currentAge.HasValue && candidateAge.HasValue)
            {
                var difference = Math.Abs(currentAge.Value - candidateAge.Value);
                var ageScore = difference <= 2 ? 20 : difference <= 5 ? 14 : difference <= 10 ? 7 : 0;
                score += ageScore;
                if (ageScore > 0) reasons.Add("Similar age range");
            }

            var sharedInterests = currentUser.UserInterests
                .Select(ui => ui.Interest?.Name)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Intersect(
                    candidate.UserInterests
                        .Select(ui => ui.Interest?.Name)
                        .Where(name => !string.IsNullOrWhiteSpace(name)),
                    StringComparer.OrdinalIgnoreCase)
                .Select(name => name!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (sharedInterests.Count > 0)
            {
                score += Math.Min(32, sharedInterests.Count * 8);
                reasons.Add($"Shared interest: {sharedInterests[0]}");
            }

            var sharedActivities = currentUser.QuickMatchPosts
                .Select(p => p.Activity?.DisplayName)
                .Where(name => !string.IsNullOrWhiteSpace(name))
                .Intersect(
                    candidate.QuickMatchPosts
                        .Select(p => p.Activity?.DisplayName)
                        .Where(name => !string.IsNullOrWhiteSpace(name)),
                    StringComparer.OrdinalIgnoreCase)
                .Select(name => name!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            if (sharedActivities.Count > 0)
            {
                score += Math.Min(20, sharedActivities.Count * 10);
                reasons.Add($"Both like {sharedActivities[0]}");
            }

            var overlaps = CalculateAvailabilityOverlaps(
                currentUser.FreeTimeSlots,
                candidate.FreeTimeSlots);

            if (overlaps.TotalMinutes >= 120)
            {
                score += 20;
                reasons.Add("Free at very similar times");
            }
            else if (overlaps.TotalMinutes > 0)
            {
                var overlapScore = Math.Clamp(overlaps.TotalMinutes / 12, 5, 15);
                score += overlapScore;
                reasons.Add("Some free time overlap");
            }

            var preferenceScore = ScorePreferences(
                currentUser.DeepMatchPreference,
                candidate.DeepMatchPreference,
                reasons);

            score += preferenceScore;

            var locationMatch = currentUser.AppSettings?.PreferPeopleNearby == false
                ? (Score: 0, Label: (string?)null, Reason: (string?)null)
                : ScoreLocation(currentUser.Profile, candidate.Profile, reasons);
            score += locationMatch.Score;

            if (candidate.IsActive)
                score += 3;

            return new DeepMatchDto
            {
                UserId = candidate.Id,
                Username = candidate.Username,
                DisplayName = candidate.Username,
                Initials = GetInitials(candidate.Username),
                ProfilePicture = candidate.Profile?.ProfilePicture,
                Location = GetPublicLocation(candidate.Profile),
                ApproximateDistanceLabel = locationMatch.Label,
                LocationReason = locationMatch.Reason,
                About = candidate.Profile?.Bio,
                CompatibilityScore = Math.Clamp(score * 100 / MaxRawScore, 0, 100),
                SharedActivities = sharedActivities,
                SharedInterests = sharedInterests,
                OverlappingAvailability = overlaps.Labels,
                Reasons = reasons.Take(4).ToList()
            };
        }

        private static int ScorePreferences(
            UserDeepMatchPreference? current,
            UserDeepMatchPreference? candidate,
            List<string> reasons)
        {
            if (current == null || candidate == null)
                return 0;

            var score = 0;

            score += ScorePreferencePair(
                current.RelationshipValue,
                candidate.RelationshipValue,
                "Both value similar relationship foundations",
                reasons);

            score += ScorePreferencePair(
                current.CommunicationStyle,
                candidate.CommunicationStyle,
                "Communication styles align",
                reasons);

            score += ScorePreferencePair(
                current.FreeTimePreference,
                candidate.FreeTimePreference,
                "Similar way of spending free time",
                reasons);

            score += ScorePreferencePair(
                current.SocialEnergy,
                candidate.SocialEnergy,
                "Similar social energy",
                reasons);

            score += ScorePreferencePair(
                current.RelationshipPace,
                candidate.RelationshipPace,
                "Similar relationship pace",
                reasons);

            return Math.Min(score, 35);
        }

        private static int ScorePreferencePair(
            string? current,
            string? candidate,
            string reason,
            List<string> reasons)
        {
            if (string.IsNullOrWhiteSpace(current) || string.IsNullOrWhiteSpace(candidate))
                return 0;

            if (Normalize(current) == Normalize(candidate))
            {
                reasons.Add(reason);
                return 10;
            }

            return SharesAnyWord(current, candidate) ? 5 : 0;
        }

        private static (int TotalMinutes, List<string> Labels) CalculateAvailabilityOverlaps(
            List<FreeTimeSlot> currentSlots,
            List<FreeTimeSlot> candidateSlots)
        {
            var total = 0;
            var labels = new List<string>();

            foreach (var current in currentSlots)
            {
                foreach (var candidate in candidateSlots.Where(slot => slot.DayOfWeek == current.DayOfWeek))
                {
                    var start = current.StartTime > candidate.StartTime
                        ? current.StartTime
                        : candidate.StartTime;
                    var end = current.EndTime < candidate.EndTime
                        ? current.EndTime
                        : candidate.EndTime;

                    if (start >= end)
                        continue;

                    var minutes = (int)(end.ToTimeSpan() - start.ToTimeSpan()).TotalMinutes;
                    total += minutes;
                    labels.Add($"{DayName(current.DayOfWeek)} {start:HH:mm}-{end:HH:mm}");
                }
            }

            return (total, labels.Take(3).ToList());
        }

        private static (int Score, string? Label, string? Reason) ScoreLocation(
            UserProfile? currentProfile,
            UserProfile? candidateProfile,
            List<string> reasons)
        {
            if (HasCoordinates(currentProfile) && HasCoordinates(candidateProfile))
            {
                var distanceKm = CalculateDistanceKm(
                    currentProfile!.Latitude!.Value,
                    currentProfile.Longitude!.Value,
                    candidateProfile!.Latitude!.Value,
                    candidateProfile.Longitude!.Value);

                var distanceScore = distanceKm switch
                {
                    <= 5 => 40,
                    <= 15 => 32,
                    <= 50 => 20,
                    <= 100 => 8,
                    _ => 0
                };

                if (distanceScore > 0)
                {
                    var label = distanceKm <= 15
                        ? "Nearby"
                        : $"Around {Math.Round(distanceKm / 10) * 10:0} km away";
                    var reason = distanceKm <= 15 ? "You are nearby" : "Similar area";
                    reasons.Add(reason);
                    return (distanceScore, label, reason);
                }

                return (0, "Far away", null);
            }

            if (currentProfile == null || candidateProfile == null)
                return (0, null, "Location is not set");

            if (!string.IsNullOrWhiteSpace(currentProfile.LocationCity) &&
                !string.IsNullOrWhiteSpace(candidateProfile.LocationCity) &&
                Normalize(currentProfile.LocationCity) == Normalize(candidateProfile.LocationCity))
            {
                reasons.Add("Same city");
                return (25, "Same city", "Same city");
            }

            if (!string.IsNullOrWhiteSpace(currentProfile.LocationCountry) &&
                !string.IsNullOrWhiteSpace(candidateProfile.LocationCountry) &&
                Normalize(currentProfile.LocationCountry) == Normalize(candidateProfile.LocationCountry))
            {
                reasons.Add("Similar area");
                return (4, "Similar area", "Similar area");
            }

            return (0, null, null);
        }

        private static bool HasCoordinates(UserProfile? profile)
        {
            return profile?.Latitude != null && profile.Longitude != null;
        }

        private static bool IsEligibleBySettings(User current, User candidate)
        {
            var age = CalculateAge(candidate.Profile?.DateOfBirth);
            if (current.AppSettings?.MinAge is int min && (!age.HasValue || age < min)) return false;
            if (current.AppSettings?.MaxAge is int max && (!age.HasValue || age > max)) return false;
            if (current.AppSettings?.MaximumDistanceKm is int maximum && HasCoordinates(current.Profile) && HasCoordinates(candidate.Profile) &&
                CalculateDistanceKm(current.Profile!.Latitude!.Value, current.Profile.Longitude!.Value,
                    candidate.Profile!.Latitude!.Value, candidate.Profile.Longitude!.Value) > maximum) return false;
            return true;
        }

        private static int? CalculateAge(DateOnly? dob)
        {
            if (!dob.HasValue) return null;
            var today = DateOnly.FromDateTime(DateTime.Today);
            var age = today.Year - dob.Value.Year;
            if (dob.Value > today.AddYears(-age)) age--;
            return age;
        }

        private static double CalculateDistanceKm(
            double firstLatitude,
            double firstLongitude,
            double secondLatitude,
            double secondLongitude)
        {
            const double earthRadiusKm = 6371;
            var dLat = DegreesToRadians(secondLatitude - firstLatitude);
            var dLon = DegreesToRadians(secondLongitude - firstLongitude);
            var lat1 = DegreesToRadians(firstLatitude);
            var lat2 = DegreesToRadians(secondLatitude);

            var a =
                Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(lat1) * Math.Cos(lat2) *
                Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
            var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));

            return earthRadiusKm * c;
        }

        private static double DegreesToRadians(double degrees)
        {
            return degrees * Math.PI / 180;
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

        private static bool SharesAnyWord(string current, string candidate)
        {
            var currentWords = Normalize(current)
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var candidateWords = Normalize(candidate)
                .Split(' ', StringSplitOptions.RemoveEmptyEntries);

            return currentWords.Intersect(candidateWords).Any();
        }

        private static string Normalize(string text)
        {
            return text.Trim().ToLowerInvariant();
        }

        private static string GetInitials(string username)
        {
            return username.Trim().Length <= 2
                ? username.Trim().ToUpperInvariant()
                : username.Trim()[..2].ToUpperInvariant();
        }

        private static string DayName(int dayOfWeek)
        {
            return dayOfWeek switch
            {
                0 => "Sunday",
                1 => "Monday",
                2 => "Tuesday",
                3 => "Wednesday",
                4 => "Thursday",
                5 => "Friday",
                6 => "Saturday",
                _ => "Day"
            };
        }
    }
}
