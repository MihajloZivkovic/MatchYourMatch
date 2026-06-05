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
        public DbSet<QuickMatchPost> QuickMatchPosts { get; set; }
        public DbSet<ActivityCategory> ActivityCategories { get; set; }
        public DbSet<Activity> Activities { get; set; }
        public AppDbContext(DbContextOptions options) : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<User>().HasIndex(u => u.Email).IsUnique();
            modelBuilder.Entity<User>().HasIndex(u => u.Username).IsUnique();
            modelBuilder.Entity<User>()
                .HasOne(u => u.Profile).WithOne(p => p.User).HasForeignKey<UserProfile>(u => u.UserId);
            
            modelBuilder.Entity<UserInterest>().HasKey(u => new  { u.UserId, u.InterestId });
            modelBuilder.Entity<UserInterest>()
                .HasOne(u => u.User).WithMany(u => u.UserInterests).HasForeignKey(u => u.UserId);
            modelBuilder.Entity<UserInterest>()
                .HasOne(u => u.Interest).WithMany(i => i.UserInterests).HasForeignKey(i => i.InterestId);

            modelBuilder.Entity<QuickMatchPost>().HasOne(q => q.User).WithMany(u => u.QuickMatchPosts).HasForeignKey(q => q.UserId);
            modelBuilder.Entity<QuickMatchPost>().Property(q => q.Description).HasMaxLength(500);

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
        }
    }
}
