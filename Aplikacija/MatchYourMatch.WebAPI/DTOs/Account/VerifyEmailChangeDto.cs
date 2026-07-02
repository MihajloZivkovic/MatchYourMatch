using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Account;

public class VerifyEmailChangeDto
{
    [Required]
    [RegularExpression(@"^\d{6}$")]
    public required string Code { get; set; }
}
