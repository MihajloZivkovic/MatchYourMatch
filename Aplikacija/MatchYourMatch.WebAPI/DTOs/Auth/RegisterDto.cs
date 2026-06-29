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

        [StringLength(160)]
        public string? FullName { get; set; }

        public DateOnly? DateOfBirth { get; set; }

        [StringLength(40)]
        public string AccountType { get; set; } = "User";

        [StringLength(40)]
        public string? Role { get; set; }

        [StringLength(80)]
        public string? OrganizationType { get; set; }
    }
}
