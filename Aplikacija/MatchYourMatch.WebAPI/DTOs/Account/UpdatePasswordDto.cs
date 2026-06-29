using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Account;

public class UpdatePasswordDto
{
    [Required]
    public required string CurrentPassword { get; set; }

    [Required]
    public required string NewPassword { get; set; }

    [Required]
    public required string ConfirmNewPassword { get; set; }
}
