using System;
using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260618120000_AddGroupChatMvp")]
    public partial class AddGroupChatMvp : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<int>(
                name: "UserBId",
                table: "ChatConversations",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "UserAId",
                table: "ChatConversations",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AlterColumn<int>(
                name: "ReceiverId",
                table: "ChatMessages",
                type: "int",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "int");

            migrationBuilder.AddColumn<int>(
                name: "CreatedByUserId",
                table: "ChatConversations",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "GroupName",
                table: "ChatConversations",
                type: "varchar(120)",
                maxLength: 120,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "IsGroup",
                table: "ChatConversations",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "ChatConversationMembers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    ConversationId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    LeftAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    IsHidden = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    LastReadAt = table.Column<DateTime>(type: "datetime(6)", nullable: true),
                    Role = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatConversationMembers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatConversationMembers_ChatConversations_ConversationId",
                        column: x => x.ConversationId,
                        principalTable: "ChatConversations",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChatConversationMembers_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "ChatMessageUserDeletions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    MessageId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessageUserDeletions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatMessageUserDeletions_ChatMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_ChatMessageUserDeletions_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversations_CreatedByUserId",
                table: "ChatConversations",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversationMembers_ConversationId_UserId",
                table: "ChatConversationMembers",
                columns: new[] { "ConversationId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatConversationMembers_UserId",
                table: "ChatConversationMembers",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessageUserDeletions_MessageId_UserId",
                table: "ChatMessageUserDeletions",
                columns: new[] { "MessageId", "UserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessageUserDeletions_UserId",
                table: "ChatMessageUserDeletions",
                column: "UserId");

            migrationBuilder.AddForeignKey(
                name: "FK_ChatConversations_Users_CreatedByUserId",
                table: "ChatConversations",
                column: "CreatedByUserId",
                principalTable: "Users",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "ChatMessageUserDeletions");
            migrationBuilder.DropTable(name: "ChatConversationMembers");
            migrationBuilder.DropForeignKey(name: "FK_ChatConversations_Users_CreatedByUserId", table: "ChatConversations");
            migrationBuilder.DropIndex(name: "IX_ChatConversations_CreatedByUserId", table: "ChatConversations");
            migrationBuilder.DropColumn(name: "CreatedByUserId", table: "ChatConversations");
            migrationBuilder.DropColumn(name: "GroupName", table: "ChatConversations");
            migrationBuilder.DropColumn(name: "IsGroup", table: "ChatConversations");

            migrationBuilder.AlterColumn<int>(
                name: "ReceiverId",
                table: "ChatMessages",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "UserBId",
                table: "ChatConversations",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "UserAId",
                table: "ChatConversations",
                type: "int",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);
        }
    }
}
