using SendGrid;
using SendGrid.Helpers.Mail;

namespace MatchYourMatch.WebAPI.Services
{
    public class EmailService
    {
        private readonly IWebHostEnvironment _environment;
        private readonly ILogger<EmailService> _logger;

        public EmailService(IWebHostEnvironment environment, ILogger<EmailService> logger)
        {
            _environment = environment;
            _logger = logger;
        }

        public Task SendResetEmailAsync(string email, string resetToken) => SendAsync(
            email,
            "MatchYourMatch - reset lozinke",
            $"<h2>Reset lozinke</h2><p>Reset token je:</p><h3>{resetToken}</h3><p>Token istice za 1 sat.</p>",
            $"Reset token: {resetToken}");

        public Task SendEmailVerificationAsync(string email, string code) => SendAsync(
            email,
            "MatchYourMatch - verify your email",
            $"<h2>Verify your email</h2><p>Your verification code is:</p><h1 style='letter-spacing:6px'>{code}</h1><p>The code expires in 15 minutes.</p>",
            $"Email verification code: {code}");

        private async Task SendAsync(string email, string subject, string html, string developmentMessage)
        {
            var apiKey = Environment.GetEnvironmentVariable("API_KEY");
            var from = Environment.GetEnvironmentVariable("FROM");

            if (string.IsNullOrWhiteSpace(apiKey) || string.IsNullOrWhiteSpace(from))
            {
                if (_environment.IsDevelopment())
                {
                    _logger.LogWarning("Email delivery is not configured. DEV ONLY for {Email}: {Message}", email, developmentMessage);
                    return;
                }
                throw new InvalidOperationException("Email delivery is not configured.");
            }

            var response = await new SendGridClient(apiKey).SendEmailAsync(
                MailHelper.CreateSingleEmail(new EmailAddress(from, "MatchYourMatch"), new EmailAddress(email), subject, string.Empty, html));
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException("Email could not be sent.");
        }
    }
}
