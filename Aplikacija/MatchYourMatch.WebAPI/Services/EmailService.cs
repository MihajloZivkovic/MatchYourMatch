using SendGrid;
using SendGrid.Helpers.Mail;

namespace MatchYourMatch.WebAPI.Services
{
    public class EmailService
    {
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

        public Task SendEventReminderAsync(string email, string eventTitle, DateTime startsAt, string location) => SendAsync(
            email,
            $"Reminder: {eventTitle} is tomorrow",
            $"""
            <h2>Event reminder</h2>
            <p><strong>{System.Net.WebUtility.HtmlEncode(eventTitle)}</strong> starts at {startsAt:yyyy-MM-dd HH:mm}.</p>
            <p>Location: {System.Net.WebUtility.HtmlEncode(location)}</p>
            <p>Open MYM to view the event details.</p>
            """,
            $"Reminder: {eventTitle} starts at {startsAt:yyyy-MM-dd HH:mm}. Location: {location}. Open MYM to view the event details.");

        private async Task SendAsync(string email, string subject, string html, string developmentMessage)
        {
            var apiKey = Environment.GetEnvironmentVariable("API_KEY");
            var from = Environment.GetEnvironmentVariable("FROM");

            var response = await new SendGridClient(apiKey).SendEmailAsync(
                MailHelper.CreateSingleEmail(new EmailAddress(from, "MatchYourMatch"), new EmailAddress(email), subject, string.Empty, html));
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException("Email could not be sent.");
        }
    }
}
