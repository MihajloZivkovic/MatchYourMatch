namespace MatchYourMatch.WebAPI.DTOs.Search
{
    public class SearchResponseDto
    {
        public string Query { get; set; } = string.Empty;
        public List<SearchPersonDto> People { get; set; } = new();
        public List<SearchEventDto> Events { get; set; } = new();
        public List<SearchActivityDto> Activities { get; set; } = new();
        public List<SearchInterestDto> Interests { get; set; } = new();
    }

    public class SearchPersonDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? ProfilePicture { get; set; }
        public string? Role { get; set; }
        public string? LocationDisplayName { get; set; }
        public bool IsPrivate { get; set; }
        public bool CanViewPrivateContent { get; set; } = true;
        public bool IsMutualFollow { get; set; }
        public List<string> Tags { get; set; } = new();
    }

    public class SearchEventDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Location { get; set; } = string.Empty;
        public DateTime DateTime { get; set; }
        public string? CategoryName { get; set; }
    }

    public class SearchActivityDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public int ActivityCategoryId { get; set; }
        public string CategoryName { get; set; } = string.Empty;
    }

    public class SearchInterestDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string? Category { get; set; }
        public int Count { get; set; }
    }
}
