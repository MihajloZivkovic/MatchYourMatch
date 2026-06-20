namespace MatchYourMatch.WebAPI.DTOs.Chat
{
    public class CreateGroupChatRequestDto
    {
        public required string GroupName { get; set; }
        public List<int> MemberUserIds { get; set; } = new();
    }
}
