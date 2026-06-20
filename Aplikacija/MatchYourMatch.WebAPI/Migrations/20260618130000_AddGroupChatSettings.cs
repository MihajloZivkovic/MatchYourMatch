using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260618130000_AddGroupChatSettings")]
    public partial class AddGroupChatSettings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "GroupPhoto",
                table: "ChatConversations",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "IsMuted",
                table: "ChatConversationMembers",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "GroupPhoto", table: "ChatConversations");
            migrationBuilder.DropColumn(name: "IsMuted", table: "ChatConversationMembers");
        }
    }
}
