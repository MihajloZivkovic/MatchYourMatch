namespace MatchYourMatch.WebAPI.Models
{
    public class UserAppSettings
    {
        public int Id { get; set; }
        public int UserId { get; set; }
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
        public bool NotifyChatMessages { get; set; } = true;
        public bool NotifyGroupMessages { get; set; } = true;
        public bool NotifyEventDiscussionReplies { get; set; } = true;
        public bool NotifyNewEventNearby { get; set; } = true;
        public bool NotifyEventStartingSoon { get; set; } = true;
        public bool NotifyNewMatchNearby { get; set; }
        public User User { get; set; } = null!;
    }
}
