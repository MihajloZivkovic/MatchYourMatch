using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Account;

public class UpdateUsernameDto
{
    [Required]
    public required string Username { get; set; }
}
