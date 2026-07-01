using System.Text.Json;
using Microsoft.AspNetCore.Authentication;

namespace MatchYourMatch.WebAPI.Services
{
    public class GoogleTokenValidator
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        public GoogleTokenValidator(IHttpClientFactory httpClientFactory, IConfiguration configuration) 
        { 
            _httpClientFactory = httpClientFactory; 
            _configuration = configuration; 
        }

        public async Task<ExternalIdentity> ValidateAsync(string? idToken)
        {
            if (string.IsNullOrWhiteSpace(idToken)) 
                throw new Exception("Google ID token is required.");

            var clientId = _configuration["Authentication:Google:ClientId"];
            if (string.IsNullOrWhiteSpace(clientId)) 
                throw new InvalidOperationException("Google login is not configured yet.");

            var response = await _httpClientFactory.CreateClient().GetAsync($"https://oauth2.googleapis.com/tokeninfo?id_token={Uri.EscapeDataString(idToken)}");
            if (!response.IsSuccessStatusCode) 
                throw new Exception("Google token is invalid.");

            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var root = json.RootElement;

            var aud = root.GetString("aud");
            var issuer = root.GetString("iss");
            var subject = root.GetString("sub");
            var email = root.GetString("email");

            var verified = root.GetString("email_verified") is "true";
            var validIssuer = issuer is "accounts.google.com" or "https://accounts.google.com";
            var validExpiry = long.TryParse(root.GetString("exp"), out var exp) 
                && DateTimeOffset.FromUnixTimeSeconds(exp) > DateTimeOffset.UtcNow;
            
            if (aud != clientId || !validIssuer || !validExpiry || string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(email))
                throw new Exception("Google token is invalid.");
            return new ExternalIdentity(
                Provider: "Google",
                Subject: subject,
                Email: email.Trim().ToLowerInvariant(),
                EmailVerified: verified,
                Name: root.GetString("name"),
                Picture: root.GetString("picture")
            );
        }
    }
}
