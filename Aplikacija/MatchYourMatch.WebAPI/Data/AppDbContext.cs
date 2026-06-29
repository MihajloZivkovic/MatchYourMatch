using MatchYourMatch.WebAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Data
{
    public class AppDbContext: DbContext
    {
        public DbSet<User> Users { get; set; }
        public DbSet<UserProfile> UserProfiles { get; set; }
        public DbSet<FreeTimeSlot> FreeTimeSlots { get; set; }
        public DbSet<Interest> Interests { get; set; }
        public DbSet<UserInterest> UserInterests { get; set; }
        public DbSet<Event> Events { get; set; }
        public DbSet<EventParticipant> EventParticipants { get; set; }
        public DbSet<EventJoinRequest> EventJoinRequests { get; set; }
        public DbSet<SavedEvent> SavedEvents { get; set; }
        public DbSet<EventDiscussionMessage> EventDiscussionMessages { get; set; }
        public DbSet<QuickMatchPost> QuickMatchPosts { get; set; }
        public DbSet<QuickMatchRequest> QuickMatchRequests { get; set; }
        public DbSet<ActivityCategory> ActivityCategories { get; set; }
        public DbSet<Activity> Activities { get; set; }
        public DbSet<UserDeepMatchPreference> UserDeepMatchPreferences { get; set; }
        public DbSet<Follow> Follows { get; set; }
        public DbSet<Notification> Notifications { get; set; }
        public DbSet<EventInvite> EventInvites { get; set; }
        public DbSet<UserRating> UserRatings { get; set; }
        public DbSet<UserMatch> UserMatches { get; set; }
        public DbSet<UserAppSettings> UserAppSettings { get; set; }
        public DbSet<BlockedUser> BlockedUsers { get; set; }
        public DbSet<HiddenProfile> HiddenProfiles { get; set; }
        public DbSet<ChatConversation> ChatConversations { get; set; }
        public DbSet<ChatConversationMember> ChatConversationMembers { get; set; }
        public DbSet<ChatMessage> ChatMessages { get; set; }
        public DbSet<ChatMessageUserDeletion> ChatMessageUserDeletions { get; set; }
        public DbSet<ChatMessageReaction> ChatMessageReactions { get; set; }
        public DbSet<MessageAttachment> MessageAttachments { get; set; }
        public DbSet<ExternalLogin> ExternalLogins { get; set; }
        public DbSet<UserReport> UserReports { get; set; }
        public AppDbContext(DbContextOptions options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            // User
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Email).IsUnique();
            modelBuilder.Entity<User>()
                .HasIndex(u => u.Username).IsUnique();
            modelBuilder.Entity<User>().Property(u => u.EmailVerificationCodeHash).HasMaxLength(64);
            modelBuilder.Entity<User>().Property(u => u.PendingEmail).HasMaxLength(255);
            modelBuilder.Entity<User>().Property(u => u.PendingEmailVerificationCodeHash).HasMaxLength(64);
            modelBuilder.Entity<ExternalLogin>().HasIndex(x => new { x.Provider, x.ProviderUserId }).IsUnique();
            modelBuilder.Entity<ExternalLogin>().Property(x => x.Provider).HasMaxLength(30);
            modelBuilder.Entity<ExternalLogin>().Property(x => x.ProviderUserId).HasMaxLength(200);
            modelBuilder.Entity<User>()
                .HasOne(u => u.Profile).WithOne(p => p.User).HasForeignKey<UserProfile>(u => u.UserId);
            modelBuilder.Entity<User>()
                .HasOne(u => u.DeepMatchPreference)
                .WithOne(p => p.User)
                .HasForeignKey<UserDeepMatchPreference>(p => p.UserId);
            modelBuilder.Entity<User>()
                .HasOne(u => u.AppSettings).WithOne(s => s.User).HasForeignKey<UserAppSettings>(s => s.UserId);
            modelBuilder.Entity<UserAppSettings>().HasIndex(s => s.UserId).IsUnique();
            modelBuilder.Entity<BlockedUser>().HasIndex(x => new { x.BlockerUserId, x.BlockedUserId }).IsUnique();
            modelBuilder.Entity<HiddenProfile>().HasIndex(x => new { x.UserId, x.HiddenUserId }).IsUnique();
            modelBuilder.Entity<UserReport>().Property(report => report.Reason).HasMaxLength(80).IsRequired();
            modelBuilder.Entity<UserReport>().Property(report => report.Details).HasMaxLength(2000);
            modelBuilder.Entity<UserReport>().Property(report => report.Status).HasMaxLength(30).IsRequired();
            modelBuilder.Entity<UserReport>().HasIndex(report => new { report.ReporterUserId, report.CreatedAt });
            modelBuilder.Entity<UserReport>().HasIndex(report => report.ReportedUserId);
            modelBuilder.Entity<UserReport>()
                .HasOne(report => report.ReporterUser).WithMany(user => user.SubmittedReports)
                .HasForeignKey(report => report.ReporterUserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<UserReport>()
                .HasOne(report => report.ReportedUser).WithMany(user => user.ReceivedReports)
                .HasForeignKey(report => report.ReportedUserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<UserReport>()
                .HasOne(report => report.ReviewedByUser).WithMany(user => user.ReviewedReports)
                .HasForeignKey(report => report.ReviewedByUserId).OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<UserProfile>()
                .Property(p => p.LocationDisplayName)
                .HasMaxLength(160);

            modelBuilder.Entity<UserProfile>()
                .Property(p => p.LocationRawInput)
                .HasMaxLength(300);

            modelBuilder.Entity<UserProfile>()
                .Property(p => p.LocationCity)
                .HasMaxLength(100);

            modelBuilder.Entity<UserProfile>()
                .Property(p => p.LocationCountry)
                .HasMaxLength(100);

            modelBuilder.Entity<UserProfile>()
                .Property(p => p.LocationPrivacy)
                .IsRequired()
                .HasMaxLength(30);
            modelBuilder.Entity<UserProfile>()
                .Property(p => p.ProfileVisibility)
                .IsRequired()
                .HasMaxLength(30)
                .HasDefaultValue("Standard");
            modelBuilder.Entity<UserProfile>().Property(p => p.FullName).HasMaxLength(160);
            modelBuilder.Entity<UserProfile>().Property(p => p.ConversationStyle).HasMaxLength(80);
            
            // UserInterest
            modelBuilder.Entity<UserInterest>()
                .HasKey(u => new  { u.UserId, u.InterestId });
            modelBuilder.Entity<UserInterest>()
                .HasOne(u => u.User).WithMany(u => u.UserInterests).HasForeignKey(u => u.UserId);
            modelBuilder.Entity<UserInterest>()
                .HasOne(u => u.Interest).WithMany(i => i.UserInterests).HasForeignKey(i => i.InterestId);

            // Event
            modelBuilder.Entity<Event>()
                .HasOne(e => e.Interest).WithMany(i => i.Events).HasForeignKey(e => e.InterestId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<Event>()
                .HasOne(e => e.Organizer).WithMany(u => u.Events).HasForeignKey(e => e.OrganizerId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<Event>().Property(e => e.Location).HasMaxLength(500);
            modelBuilder.Entity<Event>().Property(e => e.LocationCity).HasMaxLength(100);
            modelBuilder.Entity<Event>().Property(e => e.LocationCountry).HasMaxLength(100);
            modelBuilder.Entity<Event>().HasIndex(e => new { e.MinAge, e.MaxAge });
            modelBuilder.Entity<EventParticipant>()
                .HasKey(p => new { p.EventId, p.UserId });
            modelBuilder.Entity<EventParticipant>()
                .HasOne(p => p.Event).WithMany(e => e.Participants).HasForeignKey(p => p.EventId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventParticipant>()
                .HasOne(p => p.User).WithMany(u => u.EventParticipations).HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventJoinRequest>().Property(request => request.Status).HasMaxLength(20).IsRequired();
            modelBuilder.Entity<EventJoinRequest>()
                .HasIndex(request => new { request.EventId, request.UserId }).IsUnique();
            modelBuilder.Entity<EventJoinRequest>()
                .HasIndex(request => new { request.EventId, request.Status });
            modelBuilder.Entity<EventJoinRequest>()
                .HasOne(request => request.Event).WithMany(e => e.JoinRequests)
                .HasForeignKey(request => request.EventId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventJoinRequest>()
                .HasOne(request => request.User).WithMany(u => u.EventJoinRequests)
                .HasForeignKey(request => request.UserId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<SavedEvent>().HasKey(saved => new { saved.UserId, saved.EventId });
            modelBuilder.Entity<SavedEvent>().HasIndex(saved => new { saved.UserId, saved.SavedAt });
            modelBuilder.Entity<SavedEvent>()
                .HasOne(saved => saved.User).WithMany(user => user.SavedEvents)
                .HasForeignKey(saved => saved.UserId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<SavedEvent>()
                .HasOne(saved => saved.Event).WithMany(value => value.SavedByUsers)
                .HasForeignKey(saved => saved.EventId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventDiscussionMessage>()
                .HasOne(m => m.Event).WithMany(e => e.DiscussionMessages).HasForeignKey(m => m.EventId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventDiscussionMessage>()
                .HasOne(m => m.User).WithMany(u => u.EventDiscussionMessages).HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventDiscussionMessage>()
                .Property(m => m.Body)
                .IsRequired()
                .HasMaxLength(2000);
            modelBuilder.Entity<EventDiscussionMessage>()
                .HasIndex(m => new { m.EventId, m.CreatedAt });
            modelBuilder.Entity<QuickMatchPost>().HasOne(q => q.User).WithMany(u => u.QuickMatchPosts).HasForeignKey(q => q.UserId);
            modelBuilder.Entity<QuickMatchPost>().Property(q => q.Description).HasMaxLength(500);
            modelBuilder.Entity<QuickMatchPost>().HasIndex(q => new { q.IsActive, q.EndsAtUtc });
            modelBuilder.Entity<QuickMatchRequest>().Property(r => r.Status).HasMaxLength(20).IsRequired();
            modelBuilder.Entity<QuickMatchRequest>()
                .HasIndex(r => new { r.QuickMatchPostId, r.RequesterUserId }).IsUnique();
            modelBuilder.Entity<QuickMatchRequest>()
                .HasIndex(r => new { r.QuickMatchPostId, r.Status });
            modelBuilder.Entity<QuickMatchRequest>()
                .HasOne(r => r.QuickMatchPost).WithMany(p => p.Requests)
                .HasForeignKey(r => r.QuickMatchPostId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<QuickMatchRequest>()
                .HasOne(r => r.RequesterUser).WithMany(u => u.QuickMatchRequests)
                .HasForeignKey(r => r.RequesterUserId).OnDelete(DeleteBehavior.Restrict);

            // Follow
            modelBuilder.Entity<Follow>().ToTable("Follows");
            modelBuilder.Entity<Follow>()
                .HasOne(u => u.Follower).WithMany(u => u.Following).HasForeignKey(f => f.FollowerId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Follow>()
                .HasOne(u => u.Following).WithMany(u => u.Followers).HasForeignKey(f => f.FollowingId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Follow>()
                .HasIndex(f => new { f.FollowerId, f.FollowingId }).IsUnique();

            // Notifications
            modelBuilder.Entity<Notification>().Property(n => n.Type).HasMaxLength(50).IsRequired();
            modelBuilder.Entity<Notification>().Property(n => n.Title).HasMaxLength(140).IsRequired();
            modelBuilder.Entity<Notification>().Property(n => n.Message).HasMaxLength(500).IsRequired();
            modelBuilder.Entity<Notification>().Property(n => n.RelatedEntityType).HasMaxLength(50);
            modelBuilder.Entity<Notification>().HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });
            modelBuilder.Entity<Notification>()
                .HasOne(n => n.User).WithMany(u => u.Notifications).HasForeignKey(n => n.UserId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<Notification>()
                .HasOne(n => n.ActorUser).WithMany(u => u.TriggeredNotifications).HasForeignKey(n => n.ActorUserId).OnDelete(DeleteBehavior.SetNull);

            // Event invites
            modelBuilder.Entity<EventInvite>().Property(i => i.Status).HasMaxLength(20).IsRequired();
            modelBuilder.Entity<EventInvite>().HasIndex(i => new { i.EventId, i.InviteeUserId, i.Status });
            modelBuilder.Entity<EventInvite>()
                .HasOne(i => i.Event).WithMany(e => e.Invites).HasForeignKey(i => i.EventId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventInvite>()
                .HasOne(i => i.InviterUser).WithMany(u => u.SentEventInvites).HasForeignKey(i => i.InviterUserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<EventInvite>()
                .HasOne(i => i.InviteeUser).WithMany(u => u.ReceivedEventInvites).HasForeignKey(i => i.InviteeUserId).OnDelete(DeleteBehavior.Restrict);

            // User ratings
            modelBuilder.Entity<UserRating>().Property(r => r.Rating).HasPrecision(2, 1);
            modelBuilder.Entity<UserRating>()
                .HasIndex(r => new { r.RaterUserId, r.RatedUserId }).IsUnique();
            modelBuilder.Entity<UserRating>()
                .HasOne(r => r.RaterUser).WithMany(u => u.GivenRatings).HasForeignKey(r => r.RaterUserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<UserRating>()
                .HasOne(r => r.RatedUser).WithMany(u => u.ReceivedRatings).HasForeignKey(r => r.RatedUserId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<UserRating>()
                .HasOne(r => r.Event).WithMany(e => e.UserRatings).HasForeignKey(r => r.EventId).OnDelete(DeleteBehavior.SetNull);

            // Quick Match connections are separate from follows and chats.
            modelBuilder.Entity<UserMatch>().Property(m => m.Source).HasMaxLength(30).IsRequired();
            modelBuilder.Entity<UserMatch>()
                .HasIndex(m => new { m.UserAId, m.UserBId, m.Source }).IsUnique();
            modelBuilder.Entity<UserMatch>()
                .HasOne(m => m.UserA).WithMany(u => u.MatchesAsUserA).HasForeignKey(m => m.UserAId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<UserMatch>()
                .HasOne(m => m.UserB).WithMany(u => u.MatchesAsUserB).HasForeignKey(m => m.UserBId).OnDelete(DeleteBehavior.Restrict);

            // Chat
            modelBuilder.Entity<ChatConversation>()
                .HasIndex(c => new { c.UserAId, c.UserBId })
                .IsUnique();
            modelBuilder.Entity<ChatConversation>()
                .HasOne(c => c.UserA).WithMany(u => u.ChatConversationsAsUserA).HasForeignKey(c => c.UserAId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ChatConversation>()
                .HasOne(c => c.UserB).WithMany(u => u.ChatConversationsAsUserB).HasForeignKey(c => c.UserBId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ChatConversation>()
                .HasOne(c => c.CreatedByUser).WithMany(u => u.CreatedChatConversations).HasForeignKey(c => c.CreatedByUserId).OnDelete(DeleteBehavior.SetNull);
            modelBuilder.Entity<ChatConversation>()
                .Ignore(c => c.EventId);
            modelBuilder.Entity<ChatConversation>()
                .Ignore(c => c.Event);
            modelBuilder.Entity<ChatConversation>()
                .Property(c => c.GroupName)
                .HasMaxLength(120);
            modelBuilder.Entity<ChatConversation>()
                .Property(c => c.GroupPhoto)
                .HasColumnType("longtext");

            modelBuilder.Entity<ChatConversationMember>()
                .HasIndex(m => new { m.ConversationId, m.UserId })
                .IsUnique();
            modelBuilder.Entity<ChatConversationMember>()
                .HasOne(m => m.Conversation).WithMany(c => c.Members).HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ChatConversationMember>()
                .HasOne(m => m.User).WithMany(u => u.ChatConversationMemberships).HasForeignKey(m => m.UserId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ChatConversationMember>()
                .Property(m => m.Role)
                .HasMaxLength(30);

            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.Conversation).WithMany(c => c.Messages).HasForeignKey(m => m.ConversationId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.Sender).WithMany(u => u.SentChatMessages).HasForeignKey(m => m.SenderId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ChatMessage>()
                .HasOne(m => m.Receiver).WithMany(u => u.ReceivedChatMessages).HasForeignKey(m => m.ReceiverId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ChatMessage>()
                .Property(m => m.Body)
                .IsRequired()
                .HasMaxLength(2000);
            modelBuilder.Entity<ChatMessage>()
                .HasIndex(m => new { m.ConversationId, m.CreatedAt });

            modelBuilder.Entity<ChatMessageUserDeletion>()
                .HasIndex(d => new { d.MessageId, d.UserId })
                .IsUnique();
            modelBuilder.Entity<ChatMessageUserDeletion>()
                .HasOne(d => d.Message).WithMany(m => m.DeletedForUsers).HasForeignKey(d => d.MessageId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ChatMessageUserDeletion>()
                .HasOne(d => d.User).WithMany(u => u.DeletedChatMessages).HasForeignKey(d => d.UserId).OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ChatMessageReaction>()
                .HasIndex(r => new { r.MessageId, r.UserId })
                .IsUnique();
            modelBuilder.Entity<ChatMessageReaction>()
                .Property(r => r.Emoji)
                .IsRequired()
                .HasMaxLength(16);
            modelBuilder.Entity<ChatMessageReaction>()
                .HasOne(r => r.Message).WithMany(m => m.Reactions).HasForeignKey(r => r.MessageId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<ChatMessageReaction>()
                .HasOne(r => r.User).WithMany(u => u.ChatMessageReactions).HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<MessageAttachment>().Property(a => a.Kind).HasMaxLength(20).IsRequired();
            modelBuilder.Entity<MessageAttachment>().Property(a => a.OriginalFileName).HasMaxLength(255);
            modelBuilder.Entity<MessageAttachment>().Property(a => a.StoredFileName).HasMaxLength(80);
            modelBuilder.Entity<MessageAttachment>().Property(a => a.ContentType).HasMaxLength(100);
            modelBuilder.Entity<MessageAttachment>().Property(a => a.StoragePath).HasMaxLength(500);
            modelBuilder.Entity<MessageAttachment>().Property(a => a.Provider).HasMaxLength(30);
            modelBuilder.Entity<MessageAttachment>().Property(a => a.ProviderMediaId).HasMaxLength(100);
            modelBuilder.Entity<MessageAttachment>().Property(a => a.OriginalUrl).HasMaxLength(1000);
            modelBuilder.Entity<MessageAttachment>().Property(a => a.PreviewUrl).HasMaxLength(1000);
            modelBuilder.Entity<MessageAttachment>().HasIndex(a => a.ChatMessageId).IsUnique();
            modelBuilder.Entity<MessageAttachment>().HasIndex(a => a.EventDiscussionMessageId).IsUnique();
            modelBuilder.Entity<MessageAttachment>().ToTable(table => table.HasCheckConstraint("CK_MessageAttachments_OneOwner", "(`ChatMessageId` IS NOT NULL AND `EventDiscussionMessageId` IS NULL) OR (`ChatMessageId` IS NULL AND `EventDiscussionMessageId` IS NOT NULL)"));
            modelBuilder.Entity<MessageAttachment>()
                .HasOne(a => a.ChatMessage).WithOne(m => m.Attachment)
                .HasForeignKey<MessageAttachment>(a => a.ChatMessageId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<MessageAttachment>()
                .HasOne(a => a.EventDiscussionMessage).WithOne(m => m.Attachment)
                .HasForeignKey<MessageAttachment>(a => a.EventDiscussionMessageId).OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<ActivityCategory>()
                .HasMany(c => c.Activities)
                .WithOne(a => a.ActivityCategory)
                .HasForeignKey(a => a.ActivityCategoryId);

            modelBuilder.Entity<Activity>()
                .HasMany(a => a.QuickMatchPosts)
                .WithOne(q => q.Activity)
                .HasForeignKey(q => q.ActivityId);

            modelBuilder.Entity<ActivityCategory>()
                .Property(c => c.Name)
                .IsRequired()
                .HasMaxLength(100);

            modelBuilder.Entity<ActivityCategory>()
                .Property(c => c.DisplayName)
                .IsRequired()
                .HasMaxLength(100);

            modelBuilder.Entity<Activity>()
                .Property(a => a.Name)
                .IsRequired()
                .HasMaxLength(100);

            modelBuilder.Entity<Activity>()
                .Property(a => a.DisplayName)
                .IsRequired()
                .HasMaxLength(100);

            modelBuilder.Entity<UserDeepMatchPreference>()
                .HasIndex(p => p.UserId)
                .IsUnique();

            modelBuilder.Entity<UserDeepMatchPreference>()
                .Property(p => p.RelationshipValue)
                .HasMaxLength(100);

            modelBuilder.Entity<UserDeepMatchPreference>()
                .Property(p => p.CommunicationStyle)
                .HasMaxLength(100);

            modelBuilder.Entity<UserDeepMatchPreference>()
                .Property(p => p.FreeTimePreference)
                .HasMaxLength(100);

            modelBuilder.Entity<UserDeepMatchPreference>()
                .Property(p => p.SocialEnergy)
                .HasMaxLength(100);

            modelBuilder.Entity<UserDeepMatchPreference>()
                .Property(p => p.RelationshipPace)
                .HasMaxLength(100);
        }
    }
}
