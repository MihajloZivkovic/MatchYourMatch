using System.Text.Json;

namespace MatchYourMatch.WebAPI.Services
{
    public class FacebookTokenValidator
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public FacebookTokenValidator(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        public async Task<ExternalIdentity> ValidateAsync(string? accessToken)
        {
            if (string.IsNullOrWhiteSpace(accessToken)) throw new Exception("Facebook access token is required.");
            var appId = _configuration["Authentication:Facebook:AppId"];
            var appSecret = _configuration["Authentication:Facebook:AppSecret"];
            if (string.IsNullOrWhiteSpace(appId) || string.IsNullOrWhiteSpace(appSecret))
                throw new InvalidOperationException("Facebook login is missing AppId or AppSecret configuration.");

            var client = _httpClientFactory.CreateClient();
            using var debugResponse = await client.GetAsync(
                $"https://graph.facebook.com/debug_token?input_token={Uri.EscapeDataString(accessToken)}&access_token={Uri.EscapeDataString($"{appId}|{appSecret}")}");
            if (!debugResponse.IsSuccessStatusCode) throw new Exception("Facebook could not validate this login.");

            using var debugJson = JsonDocument.Parse(await debugResponse.Content.ReadAsStringAsync());
            var data = debugJson.RootElement.GetProperty("data");
            var isValid = data.TryGetProperty("is_valid", out var valid) && valid.GetBoolean();
            var tokenAppId = data.TryGetProperty("app_id", out var tokenApp) ? tokenApp.GetString() : null;
            var userId = data.TryGetProperty("user_id", out var uid) ? uid.GetString() : null;
            var expiresAt = data.TryGetProperty("expires_at", out var expiry) ? expiry.GetInt64() : 0;
            if (!isValid || tokenAppId != appId || string.IsNullOrWhiteSpace(userId) ||
                (expiresAt > 0 && DateTimeOffset.FromUnixTimeSeconds(expiresAt) <= DateTimeOffset.UtcNow))
                throw new Exception("Facebook access token is invalid or expired.");

            using var profileResponse = await client.GetAsync(
                $"https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token={Uri.EscapeDataString(accessToken)}");
            if (!profileResponse.IsSuccessStatusCode) throw new Exception("Facebook profile could not be loaded.");
            using var profileJson = JsonDocument.Parse(await profileResponse.Content.ReadAsStringAsync());
            var profile = profileJson.RootElement;
            var profileId = profile.GetProperty("id").GetString();
            var email = profile.TryGetProperty("email", out var emailValue) ? emailValue.GetString() : null;
            if (profileId != userId) throw new Exception("Facebook profile does not match the validated token.");
            if (string.IsNullOrWhiteSpace(email))
                throw new Exception("Facebook did not provide an email address. Allow the email permission and try again.");

            string? picture = null;
            if (profile.TryGetProperty("picture", out var pictureValue) &&
                pictureValue.TryGetProperty("data", out var pictureData) &&
                pictureData.TryGetProperty("url", out var pictureUrl)) picture = pictureUrl.GetString();

            var name = profile.TryGetProperty("name", out var nameValue) ? nameValue.GetString() : null;
            return new ExternalIdentity("Facebook", userId!, email.Trim().ToLowerInvariant(), true, name, picture);
        }
    }
}
