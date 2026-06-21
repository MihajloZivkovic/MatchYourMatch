namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class UpdateProfileTagsDto
    {
        public List<string>? LittleThings { get; set; }
        public List<string>? CurrentlyExploring { get; set; }
    }
}
