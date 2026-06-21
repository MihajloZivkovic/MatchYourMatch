using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    public partial class AddNotificationsAndEventInvites : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "EventInvites",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    InviterUserId = table.Column<int>(type: "int", nullable: false),
                    InviteeUserId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventInvites", x => x.Id);
                    table.ForeignKey("FK_EventInvites_Events_EventId", x => x.EventId, "Events", "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_EventInvites_Users_InviteeUserId", x => x.InviteeUserId, "Users", "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey("FK_EventInvites_Users_InviterUserId", x => x.InviterUserId, "Users", "Id", onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateTable(
                name: "Notifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ActorUserId = table.Column<int>(type: "int", nullable: true),
                    Type = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Title = table.Column<string>(type: "varchar(140)", maxLength: 140, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    Message = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RelatedEntityType = table.Column<string>(type: "varchar(50)", maxLength: 50, nullable: true)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    RelatedEntityId = table.Column<int>(type: "int", nullable: true),
                    IsRead = table.Column<bool>(type: "tinyint(1)", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    ReadAt = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Notifications", x => x.Id);
                    table.ForeignKey("FK_Notifications_Users_ActorUserId", x => x.ActorUserId, "Users", "Id", onDelete: ReferentialAction.SetNull);
                    table.ForeignKey("FK_Notifications_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex("IX_EventInvites_EventId_InviteeUserId_Status", "EventInvites", new[] { "EventId", "InviteeUserId", "Status" });
            migrationBuilder.CreateIndex("IX_EventInvites_InviteeUserId", "EventInvites", "InviteeUserId");
            migrationBuilder.CreateIndex("IX_EventInvites_InviterUserId", "EventInvites", "InviterUserId");
            migrationBuilder.CreateIndex("IX_Notifications_ActorUserId", "Notifications", "ActorUserId");
            migrationBuilder.CreateIndex("IX_Notifications_UserId_IsRead_CreatedAt", "Notifications", new[] { "UserId", "IsRead", "CreatedAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "EventInvites");
            migrationBuilder.DropTable(name: "Notifications");
        }
    }
}
