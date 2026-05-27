namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class CreateFreeTimeSlotDto
    {
        public int DayOfWeek { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
    }   
}