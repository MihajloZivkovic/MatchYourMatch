using SendGrid;
using SendGrid.Helpers.Mail;

namespace MatchYourMatch.WebAPI.Services
{
    public class EmailService
    {
        public async Task SendResetEmailAsync(string email, string resetToken)
        {
            var apikey = Environment.GetEnvironmentVariable("API_KEY");
            var from = Environment.GetEnvironmentVariable("FROM");
            var client = new SendGridClient(apikey);
            var fromMail = new EmailAddress(from, "MatchYourMatch");
            var to = new EmailAddress(email);
            var subject = "MatchYourMatch - reset lozinke";
            var content = $@"<h2>Reset lozinke</h2>
                             <p>Reset token je:</p>
                             <h3>{resetToken}</h3>
                             <p>Token istice za 1 sat.</p>";
            var msg = MailHelper.CreateSingleEmail(fromMail, to, subject, "", content);
            await client.SendEmailAsync(msg);
        }
    }
}
