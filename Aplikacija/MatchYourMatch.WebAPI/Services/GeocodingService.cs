using MatchYourMatch.WebAPI.Services.Interfaces;
using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace MatchYourMatch.WebAPI.Services
{
    public class GeocodingService : IGeocodingService
    {
        private readonly HttpClient _httpClient;
        private readonly IConfiguration _configuration;
        private readonly ILogger<GeocodingService> _logger;

        public GeocodingService(
            HttpClient httpClient,
            IConfiguration configuration,
            ILogger<GeocodingService> logger)
        {
            _httpClient = httpClient;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<GeocodingResult?> GeocodeAsync(string locationInput)
        {
            return (await SearchAsync(locationInput, 1)).FirstOrDefault();
        }

        public async Task<List<GeocodingResult>> SearchAsync(string locationInput, int limit = 5)
        {
            if (string.IsNullOrWhiteSpace(locationInput))
                return new List<GeocodingResult>();

            var baseUrl = _configuration["Geocoding:BaseUrl"]
                ?? "https://nominatim.openstreetmap.org/search";
            var userAgent = _configuration["Geocoding:UserAgent"]
                ?? "MatchYourMatch/1.0";
            var resultLimit = Math.Clamp(limit, 1, 8);

            using var request = new HttpRequestMessage(
                HttpMethod.Get,
                $"{baseUrl}?format=json&limit={resultLimit}&addressdetails=1&accept-language=en&q={Uri.EscapeDataString(locationInput.Trim())}");

            request.Headers.UserAgent.ParseAdd(userAgent);

            try
            {
                using var response = await _httpClient.SendAsync(request);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Geocoding request failed with status code {StatusCode}.",
                        response.StatusCode);
                    return new List<GeocodingResult>();
                }

                await using var stream = await response.Content.ReadAsStreamAsync();
                var results = await JsonSerializer.DeserializeAsync<List<NominatimResult>>(
                    stream,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                return results?
                    .Select(MapResult)
                    .Where(result => result != null)
                    .Cast<GeocodingResult>()
                    .DistinctBy(result => result.LocationInput.ToLowerInvariant())
                    .Take(resultLimit)
                    .ToList() ?? new List<GeocodingResult>();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Geocoding request could not be completed.");
                return new List<GeocodingResult>();
            }
        }

        private static GeocodingResult? MapResult(NominatimResult result)
        {
            if (!double.TryParse(result.Latitude, NumberStyles.Float, CultureInfo.InvariantCulture, out var latitude) ||
                !double.TryParse(result.Longitude, NumberStyles.Float, CultureInfo.InvariantCulture, out var longitude))
            {
                return null;
            }

            var city = FirstNonEmpty(
                result.Address?.City,
                result.Address?.Town,
                result.Address?.Village,
                result.Address?.Municipality,
                result.Address?.County,
                result.Address?.State);
            var country = result.Address?.Country;
            var displayName = BuildPublicDisplayName(city, country);

            if (string.IsNullOrWhiteSpace(displayName))
                return null;

            return new GeocodingResult
            {
                Latitude = latitude,
                Longitude = longitude,
                City = city,
                Country = country,
                DisplayName = displayName,
                LocationInput = result.DisplayName
            };
        }

        private static string? FirstNonEmpty(params string?[] values)
        {
            return values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim();
        }

        private static string BuildPublicDisplayName(string? city, string? country)
        {
            var parts = new[] { city, country }
                .Where(part => !string.IsNullOrWhiteSpace(part))
                .Select(part => part!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            return string.Join(", ", parts);
        }

        private class NominatimResult
        {
            [JsonPropertyName("lat")]
            public string Latitude { get; set; } = string.Empty;

            [JsonPropertyName("lon")]
            public string Longitude { get; set; } = string.Empty;

            [JsonPropertyName("address")]
            public NominatimAddress? Address { get; set; }

            [JsonPropertyName("display_name")]
            public string DisplayName { get; set; } = string.Empty;
        }

        private class NominatimAddress
        {
            [JsonPropertyName("city")]
            public string? City { get; set; }

            [JsonPropertyName("town")]
            public string? Town { get; set; }

            [JsonPropertyName("village")]
            public string? Village { get; set; }

            [JsonPropertyName("municipality")]
            public string? Municipality { get; set; }

            [JsonPropertyName("county")]
            public string? County { get; set; }

            [JsonPropertyName("state")]
            public string? State { get; set; }

            [JsonPropertyName("country")]
            public string? Country { get; set; }
        }
    }
}
