using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers;

[ApiController]
[Route("api/giphy")]
[Authorize(Roles = "User,Organizer")]
public class GiphyController : ControllerBase
{
    private readonly IHttpClientFactory _clients;
    private readonly IConfiguration _configuration;

    public GiphyController(IHttpClientFactory clients, IConfiguration configuration)
    {
        _clients = clients;
        _configuration = configuration;
    }

    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] string? query, [FromQuery] int limit = 18, CancellationToken cancellationToken = default)
    {
        var apiKey = _configuration["VITE_GIPHY_API_KEY"] ?? _configuration["Giphy:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey)) 
            return StatusCode(503, "GIPHY is not configured.");

        limit = Math.Clamp(limit, 1, 25);
        var endpoint = string.IsNullOrWhiteSpace(query) ? "trending" : "search";
        var values = new Dictionary<string, string?> { ["api_key"] = apiKey, ["limit"] = limit.ToString(), ["rating"] = "pg", ["lang"] = "en" };
        if (endpoint == "search") 
            values["q"] = query!.Trim()[..Math.Min(query.Trim().Length, 100)];

        var args = string.Join("&", values.Select(pair => $"{Uri.EscapeDataString(pair.Key)}={Uri.EscapeDataString(pair.Value ?? string.Empty)}"));
        using var response = await _clients.CreateClient().GetAsync($"https://api.giphy.com/v1/gifs/{endpoint}?{args}", cancellationToken);
        return new ContentResult 
        { 
            StatusCode = (int)response.StatusCode, 
            ContentType = "application/json", 
            Content = await response.Content.ReadAsStringAsync(cancellationToken) 
        };
    }
}
