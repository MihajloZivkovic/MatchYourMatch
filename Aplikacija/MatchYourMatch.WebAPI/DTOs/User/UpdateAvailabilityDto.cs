namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class UpdateAvailabilityDto
    {
        public List<CreateFreeTimeSlotDto> Slots { get; set; } = new();
    }
}
