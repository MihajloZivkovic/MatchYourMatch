using MatchYourMatch.WebAPI.Services;

namespace MatchYourMatch.WebAPI.Services.Interfaces
{
    public interface IGeocodingService
    {
        Task<GeocodingResult?> GeocodeAsync(string locationInput);

        Task<List<GeocodingResult>> SearchAsync(string locationInput, int limit = 5);
    }
}
