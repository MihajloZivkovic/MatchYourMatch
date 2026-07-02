namespace MatchYourMatch.WebAPI.DTOs.Settings
{
    public class UserAppSettingsDto
    {
        public int? MaximumDistanceKm { get; set; }
        public bool ShowMeInQuickMatch { get; set; } = true;
        public bool ShowMeInDeepMatch { get; set; } = true;
        public bool PreferPeopleNearby { get; set; } = true;
        public int? MinAge { get; set; }
        public int? MaxAge { get; set; }
        public string WhoCanMessageMe { get; set; } = "MatchesOnly";
        public string AllowEventInvitesFrom { get; set; } = "PeopleIFollow";
        public string AllowGroupChatInvitesFrom { get; set; } = "MatchesOnly";
        public bool NotifyEventInvites { get; set; } = true;
        public bool NotifyNewFollowers { get; set; } = true;
        public bool NotifyQuickMatches { get; set; } = true;
        public bool NotifyEventStartingSoon { get; set; } = true;
    }

    public class SafetyUserDto
    {
        public int UserId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string? ProfilePicture { get; set; }
    }
}
