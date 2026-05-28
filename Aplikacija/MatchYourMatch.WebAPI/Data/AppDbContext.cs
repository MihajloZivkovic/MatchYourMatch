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
        }
    }
}
