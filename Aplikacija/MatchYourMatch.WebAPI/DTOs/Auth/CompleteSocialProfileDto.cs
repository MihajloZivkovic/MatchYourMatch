using System.ComponentModel.DataAnnotations;
namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class CompleteSocialProfileDto
    {
        [Required] public DateOnly? DateOfBirth { get; set; }
        [StringLength(160)] public string? FullName { get; set; }
        [StringLength(100)] public string? Username { get; set; }
    }
}
