namespace MatchYourMatch.WebAPI.Models
{
    public class FreeTimeSlot
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public int DayOfWeek { get; set; }
        public TimeOnly StartTime { get; set; }
        public TimeOnly EndTime { get; set; }
    }
}
