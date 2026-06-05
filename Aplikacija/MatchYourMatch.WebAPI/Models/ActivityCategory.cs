namespace MatchYourMatch.WebAPI.Models
{
    public class ActivityCategory
    {
        public int Id { get; set; }

        public string Name { get; set; } = null!;

        public string DisplayName { get; set; } = null!;

        public List<Activity> Activities { get; set; } = new();
    }
}