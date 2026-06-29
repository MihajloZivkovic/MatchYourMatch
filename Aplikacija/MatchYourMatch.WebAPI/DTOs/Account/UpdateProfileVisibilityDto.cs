using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Account;

public class UpdateProfileVisibilityDto
{
    [Required]
    public required string ProfileVisibility { get; set; }
}
