using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddAppSettingsAndProfileIdentity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "DateOfBirth",
                table: "UserProfiles",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "FullName",
                table: "UserProfiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<bool>(
                name: "ShowAge",
                table: "UserProfiles",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "ShowFullName",
                table: "UserProfiles",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "BlockedUsers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    BlockerUserId = table.Column<int>(type: "int", nullable: false),
                    BlockedUserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BlockedUsers", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "HiddenProfiles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    HiddenUserId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HiddenProfiles", x => x.Id);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "UserAppSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    MaximumDistanceKm = table.Column<int>(type: "int", nullable: true),
                    ShowMeInQuickMatch = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    ShowMeInDeepMatch = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    PreferPeopleNearby = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    MinAge = table.Column<int>(type: "int", nullable: true),
                    MaxAge = table.Column<int>(type: "int", nullable: true),
                    WhoCanMessageMe = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AllowEventInvitesFrom = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    AllowGroupChatInvitesFrom = table.Column<string>(type: "longtext", nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    NotifyEventInvites = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    NotifyNewFollowers = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    NotifyQuickMatches = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    NotifyChatMessages = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    NotifyGroupMessages = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    NotifyEventDiscussionReplies = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    NotifyNewEventNearby = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    NotifyEventStartingSoon = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    NotifyNewMatchNearby = table.Column<bool>(type: "tinyint(1)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_UserAppSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_UserAppSettings_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_BlockedUsers_BlockerUserId_BlockedUserId",
                table: "BlockedUsers",
                columns: new[] { "BlockerUserId", "BlockedUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_HiddenProfiles_UserId_HiddenUserId",
                table: "HiddenProfiles",
                columns: new[] { "UserId", "HiddenUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_UserAppSettings_UserId",
                table: "UserAppSettings",
                column: "UserId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BlockedUsers");

            migrationBuilder.DropTable(
                name: "HiddenProfiles");

            migrationBuilder.DropTable(
                name: "UserAppSettings");

            migrationBuilder.DropColumn(
                name: "DateOfBirth",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "FullName",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "ShowAge",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "ShowFullName",
                table: "UserProfiles");
        }
    }
}
