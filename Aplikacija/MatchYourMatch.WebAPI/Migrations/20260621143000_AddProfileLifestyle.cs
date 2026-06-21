using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260621143000_AddProfileLifestyle")]
    public partial class AddProfileLifestyle : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>("FavoriteActivitiesJson", "UserProfiles", "longtext", nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<int>("SocialEnergy", "UserProfiles", "int", nullable: true);
            migrationBuilder.AddColumn<string>("ConversationStyle", "UserProfiles", "varchar(80)", maxLength: 80, nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<string>("LookingForJson", "UserProfiles", "longtext", nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn("FavoriteActivitiesJson", "UserProfiles");
            migrationBuilder.DropColumn("SocialEnergy", "UserProfiles");
            migrationBuilder.DropColumn("ConversationStyle", "UserProfiles");
            migrationBuilder.DropColumn("LookingForJson", "UserProfiles");
        }
    }
}
