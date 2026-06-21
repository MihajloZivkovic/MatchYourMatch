namespace MatchYourMatch.WebAPI.Models
{
    public class User
    {
        public int Id { get; set; }
        public required string Username { get; set; }
        public required string Email { get; set; }
        public required string PasswordHash { get; set; }
        public string Role { get; set; } = "User";
        public bool IsActive { get; set; } = true;
        public bool EmailConfirmed { get; set; }
        public DateTime? EmailConfirmedAt { get; set; }
        public string? EmailVerificationCodeHash { get; set; }
        public DateTime? EmailVerificationCodeExpiresAt { get; set; }
        public DateTime? EmailVerificationCodeSentAt { get; set; }
        public UserProfile? Profile { get; set; }
        public UserDeepMatchPreference? DeepMatchPreference { get; set; }
        public UserAppSettings? AppSettings { get; set; }
        public List<FreeTimeSlot> FreeTimeSlots { get; set; } = new();
        public List<UserInterest> UserInterests { get; set; } = new();
        public List<Event> Events { get; set; } = new();
        public List<EventParticipant> EventParticipations { get; set; } = new();
        public List<EventDiscussionMessage> EventDiscussionMessages { get; set; } = new();
        public List<QuickMatchPost> QuickMatchPosts {get; set;} = new();
        public List<Follow> Followers { get; set; } = new();
        public List<Follow> Following { get; set; } = new();
        public List<Notification> Notifications { get; set; } = new();
        public List<Notification> TriggeredNotifications { get; set; } = new();
        public List<EventInvite> SentEventInvites { get; set; } = new();
        public List<EventInvite> ReceivedEventInvites { get; set; } = new();
        public List<UserRating> GivenRatings { get; set; } = new();
        public List<UserRating> ReceivedRatings { get; set; } = new();
        public List<UserMatch> MatchesAsUserA { get; set; } = new();
        public List<UserMatch> MatchesAsUserB { get; set; } = new();
        public string? ResetToken { get; set; }
        public DateTime? ResetTokenExpiry { get; set; }
        public List<ChatConversation> ChatConversationsAsUserA { get; set; } = new();
        public List<ChatConversation> ChatConversationsAsUserB { get; set; } = new();
        public List<ChatConversation> CreatedChatConversations { get; set; } = new();
        public List<ChatConversationMember> ChatConversationMemberships { get; set; } = new();
        public List<ChatMessage> SentChatMessages { get; set; } = new();
        public List<ChatMessage> ReceivedChatMessages { get; set; } = new();
        public List<ChatMessageUserDeletion> DeletedChatMessages { get; set; } = new();
        public List<ChatMessageReaction> ChatMessageReactions { get; set; } = new();
    }
}
