using System.ComponentModel.DataAnnotations;

namespace MatchYourMatch.WebAPI.DTOs.Auth
{
    public class GuestLoginDto
    {
        [Required]
        public required string City { get; set; }
    }
}
