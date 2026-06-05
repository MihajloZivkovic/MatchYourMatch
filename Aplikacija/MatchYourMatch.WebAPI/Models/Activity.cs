namespace MatchYourMatch.WebAPI.Models
{
    public class Activity
    {
        public int Id { get; set; }

        public string Name { get; set; } = null!;

        public string DisplayName { get; set; } = null!;

        public int ActivityCategoryId { get; set; }

        public ActivityCategory ActivityCategory { get; set; } = null!;

        public List<QuickMatchPost> QuickMatchPosts { get; set; } = new();
    }
}