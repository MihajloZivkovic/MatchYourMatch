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
        public DbSet<QuickMatchPost> QuickMatchPosts { get; set; }
        public DbSet<ActivityCategory> ActivityCategories { get; set; }
        public DbSet<Activity> Activities { get; set; }
        public DbSet<UserDeepMatchPreference> UserDeepMatchPreferences { get; set; }
        public DbSet<Follow> Follows { get; set; }
        public DbSet<ChatConversation> ChatConversations { get; set; }
        public DbSet<ChatMessage> ChatMessages { get; set; }
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
            modelBuilder.Entity<User>()
                .HasOne(u => u.Profile).WithOne(p => p.User).HasForeignKey<UserProfile>(u => u.UserId);
            modelBuilder.Entity<User>()
                .HasOne(u => u.DeepMatchPreference)
                .WithOne(p => p.User)
                .HasForeignKey<UserDeepMatchPreference>(p => p.UserId);

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
            modelBuilder.Entity<EventParticipant>()
                .HasKey(p => new { p.EventId, p.UserId });
            modelBuilder.Entity<EventParticipant>()
                .HasOne(p => p.Event).WithMany(e => e.Participants).HasForeignKey(p => p.EventId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<EventParticipant>()
                .HasOne(p => p.User).WithMany(u => u.EventParticipations).HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
            modelBuilder.Entity<QuickMatchPost>().HasOne(q => q.User).WithMany(u => u.QuickMatchPosts).HasForeignKey(q => q.UserId);
            modelBuilder.Entity<QuickMatchPost>().Property(q => q.Description).HasMaxLength(500);

            // Follow
            modelBuilder.Entity<Follow>()
                .HasOne(u => u.Follower).WithMany(u => u.Following).HasForeignKey(f => f.FollowerId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<Follow>()
                .HasOne(u => u.Following).WithMany(u => u.Followers).HasForeignKey(f => f.FollowingId).OnDelete(DeleteBehavior.Restrict);

            // Chat
            modelBuilder.Entity<ChatConversation>()
                .HasIndex(c => new { c.UserAId, c.UserBId })
                .IsUnique();
            modelBuilder.Entity<ChatConversation>()
                .HasOne(c => c.UserA).WithMany(u => u.ChatConversationsAsUserA).HasForeignKey(c => c.UserAId).OnDelete(DeleteBehavior.Restrict);
            modelBuilder.Entity<ChatConversation>()
                .HasOne(c => c.UserB).WithMany(u => u.ChatConversationsAsUserB).HasForeignKey(c => c.UserBId).OnDelete(DeleteBehavior.Restrict);

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
