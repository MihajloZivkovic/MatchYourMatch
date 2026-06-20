using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260618165000_AddEventDiscussionThreads")]
    public partial class AddEventDiscussionThreads : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "EventId",
                table: "ChatConversations",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversations_EventId",
                table: "ChatConversations",
                column: "EventId",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ChatConversations_Events_EventId",
                table: "ChatConversations",
                column: "EventId",
                principalTable: "Events",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ChatConversations_Events_EventId",
                table: "ChatConversations");

            migrationBuilder.DropIndex(
                name: "IX_ChatConversations_EventId",
                table: "ChatConversations");

            migrationBuilder.DropColumn(
                name: "EventId",
                table: "ChatConversations");
        }
    }
}
