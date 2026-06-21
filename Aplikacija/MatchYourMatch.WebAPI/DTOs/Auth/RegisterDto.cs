using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class RegisterDto
    {
        [Required]
        public required string Username { get; set; }

        [Required]
        [EmailAddress]
        public required string Email { get; set; }

        [Required]
        public required string Password { get; set; }

        [Required]
        [StringLength(160)]
        public required string FullName { get; set; }

        [Required]
        public DateOnly? DateOfBirth { get; set; }

        public string Role { get; set; } = "User";
    }
}
