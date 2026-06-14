using SendGrid;
using SendGrid.Helpers.Mail;

namespace MatchYourMatch.WebAPI.Services
{
    public class EmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration config)
        {
            _config = config;
        }

        public async Task SendResetEmailAsync(string email, string resetToken)
        {
            var client = new SendGridClient(_config["SendGrid:ApiKey"]);
            var from = new EmailAddress(_config["SendGrid:From"], "MatchYourMatch");
            var to = new EmailAddress(email);
            var subject = "MatchYourMatch - reset lozinke";
            var content = $@"<h2>Reset lozinke</h2>
                             <p>Reset token je:</p>
                             <h3>{resetToken}</h3>
                             <p>Token istice za 1 sat.</p>";
            var msg = MailHelper.CreateSingleEmail(from, to, subject, "", content);
            await client.SendEmailAsync(msg);
        }
    }
}
