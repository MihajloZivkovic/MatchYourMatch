namespace MatchYourMatch.WebAPI.DTOs.User
{
    public class FollowDto
    {
        public int Id { get; set; }
        public int UserId { get; set; }
        public required string Username { get; set; }
        public string? DisplayName { get; set; }
        public string? ProfilePictureUrl { get; set; }
        public string? Location { get; set; }
        public bool IsFollowing { get; set; }
    }
}
