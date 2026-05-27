namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class FreeTimeSlotDto
    {
        public int Id { get; set; }
        public int DayOfWeek { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
    }   
}