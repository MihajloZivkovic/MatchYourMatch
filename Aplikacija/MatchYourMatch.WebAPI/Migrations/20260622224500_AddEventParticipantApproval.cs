using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    public partial class AddEventParticipantApproval : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "RequiresParticipantApproval",
                table: "Events",
                type: "tinyint(1)",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "EventJoinRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    EventId = table.Column<int>(type: "int", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_EventJoinRequests", x => x.Id);
                    table.ForeignKey("FK_EventJoinRequests_Events_EventId", x => x.EventId, "Events", "Id", onDelete: ReferentialAction.Cascade);
                    table.ForeignKey("FK_EventJoinRequests_Users_UserId", x => x.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_EventJoinRequests_EventId_Status",
                table: "EventJoinRequests",
                columns: new[] { "EventId", "Status" });
            migrationBuilder.CreateIndex(
                name: "IX_EventJoinRequests_EventId_UserId",
                table: "EventJoinRequests",
                columns: new[] { "EventId", "UserId" },
                unique: true);
            migrationBuilder.CreateIndex(
                name: "IX_EventJoinRequests_UserId",
                table: "EventJoinRequests",
                column: "UserId");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "EventJoinRequests");
            migrationBuilder.DropColumn(name: "RequiresParticipantApproval", table: "Events");
        }
    }
}
