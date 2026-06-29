using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Account;

public class UpdateEmailDto
{
    [Required]
    [EmailAddress]
    public required string NewEmail { get; set; }

    [Required]
    public required string Password { get; set; }
}
