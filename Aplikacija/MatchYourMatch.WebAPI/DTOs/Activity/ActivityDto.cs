namespace MatchYourMatch.WebAPI.DTOs.Activity
{
    public class ActivityDto
    {
        public int Id { get; set; }

        public string Name { get; set; } = null!;

        public string DisplayName { get; set; } = null!;

        public int ActivityCategoryId { get; set; }

        public string ActivityCategoryName { get; set; } = null!;
    }
}
