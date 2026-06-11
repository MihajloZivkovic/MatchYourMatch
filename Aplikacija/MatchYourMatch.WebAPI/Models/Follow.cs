namespace MatchYourMatch.WebAPI.Models
{
    public class Follow
    {
        public int Id { get; set; }
        public int FollowerId { get; set; }
        public int FollowingId { get; set; }
        public required User Follower { get; set; }
        public required User Following { get; set; } 
    }
}
