namespace MatchYourMatch.WebAPI.Services
{
    public record ExternalIdentity(
        string Provider,
        string Subject,
        string Email,
        bool EmailVerified,
        string? Name,
        string? Picture);
}
