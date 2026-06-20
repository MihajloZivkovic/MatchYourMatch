namespace MatchYourMatch.WebAPI.DTOs.Chat
{
    public class GroupChatSettingsDto
    {
        public int ConversationId { get; set; }
        public required string GroupName { get; set; }
        public string? GroupPhoto { get; set; }
        public int MemberCount { get; set; }
        public string CurrentUserRole { get; set; } = "Member";
        public bool IsCurrentUserAdmin { get; set; }
        public bool IsMuted { get; set; }
        public string? CreatedByUsername { get; set; }
        public List<GroupChatMemberDto> Members { get; set; } = new();
    }

    public class GroupChatMemberDto
    {
        public int UserId { get; set; }
        public required string Username { get; set; }
        public string? DisplayName { get; set; }
        public string? Initials { get; set; }
        public string? Avatar { get; set; }
        public string Role { get; set; } = "Member";
        public bool IsAdmin { get; set; }
        public bool IsCurrentUser { get; set; }
    }
}
