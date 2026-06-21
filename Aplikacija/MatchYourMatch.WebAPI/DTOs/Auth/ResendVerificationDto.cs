using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class ResendVerificationDto
    {
        [Required, EmailAddress]
        public string Email { get; set; } = string.Empty;
    }
}
