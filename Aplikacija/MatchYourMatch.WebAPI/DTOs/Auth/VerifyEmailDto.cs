using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class VerifyEmailDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
        [Required, RegularExpression(@"^\d{6}$")]
        public string Code { get; set; } = string.Empty;
    }
}
