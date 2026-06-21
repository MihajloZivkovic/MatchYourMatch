using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace MatchYourMatch.WebAPI.Services
{
    public class MicrosoftTokenValidator
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;

        public MicrosoftTokenValidator(IHttpClientFactory httpClientFactory, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
        }

        public async Task<ExternalIdentity> ValidateAsync(string? idToken)
        {
            if (string.IsNullOrWhiteSpace(idToken)) throw new Exception("Microsoft ID token is required.");
            var clientId = _configuration["Authentication:Microsoft:ClientId"];
            var configuredTenant = _configuration["Authentication:Microsoft:TenantId"];
            if (string.IsNullOrWhiteSpace(clientId) || string.IsNullOrWhiteSpace(configuredTenant))
                throw new InvalidOperationException("Microsoft login is missing ClientId or TenantId configuration.");

            var handler = new JwtSecurityTokenHandler { MapInboundClaims = false };
            if (!handler.CanReadToken(idToken)) throw new Exception("Microsoft ID token is invalid.");
            var unvalidated = handler.ReadJwtToken(idToken);
            var tokenTenant = unvalidated.Claims.FirstOrDefault(c => c.Type == "tid")?.Value;
            if (string.IsNullOrWhiteSpace(tokenTenant)) throw new Exception("Microsoft token has no tenant identifier.");
            var acceptsAnyTenant = configuredTenant is "common" or "organizations" or "consumers";
            if (!acceptsAnyTenant && !string.Equals(configuredTenant, tokenTenant, StringComparison.OrdinalIgnoreCase))
                throw new Exception("Microsoft account belongs to a tenant that is not allowed.");

            var client = _httpClientFactory.CreateClient();
            using var metadataResponse = await client.GetAsync(
                $"https://login.microsoftonline.com/{Uri.EscapeDataString(tokenTenant)}/v2.0/.well-known/openid-configuration");
            if (!metadataResponse.IsSuccessStatusCode) throw new Exception("Microsoft identity metadata is unavailable.");
            using var metadata = JsonDocument.Parse(await metadataResponse.Content.ReadAsStringAsync());
            var issuer = metadata.RootElement.GetProperty("issuer").GetString();
            var jwksUri = metadata.RootElement.GetProperty("jwks_uri").GetString();
            if (string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(jwksUri))
                throw new Exception("Microsoft identity metadata is invalid.");

            var jwksJson = await client.GetStringAsync(jwksUri);
            var signingKeys = new JsonWebKeySet(jwksJson).GetSigningKeys();
            var principal = handler.ValidateToken(idToken, new TokenValidationParameters
            {
                ValidateIssuerSigningKey = true,
                IssuerSigningKeys = signingKeys,
                ValidateIssuer = true,
                ValidIssuer = issuer,
                ValidateAudience = true,
                ValidAudience = clientId,
                ValidateLifetime = true,
                ValidAlgorithms = new[] { SecurityAlgorithms.RsaSha256 },
                ClockSkew = TimeSpan.FromMinutes(2)
            }, out _);

            var subject = Claim(principal, "oid") ?? Claim(principal, "sub");
            var email = Claim(principal, "email") ?? Claim(principal, "preferred_username");
            var name = Claim(principal, "name");
            if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
                throw new Exception("Microsoft account did not provide a usable email address.");
            return new ExternalIdentity("Microsoft", subject, email.Trim().ToLowerInvariant(), true, name, null);
        }

        private static string? Claim(ClaimsPrincipal principal, string type) =>
            principal.Claims.FirstOrDefault(c => c.Type == type)?.Value;
    }
}
