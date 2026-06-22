using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260622203000_AddSavedEvents")]
public partial class AddSavedEvents : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "SavedEvents",
            columns: table => new
            {
                UserId = table.Column<int>(type: "int", nullable: false),
                EventId = table.Column<int>(type: "int", nullable: false),
                SavedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_SavedEvents", value => new { value.UserId, value.EventId });
                table.ForeignKey("FK_SavedEvents_Events_EventId", value => value.EventId, "Events", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_SavedEvents_Users_UserId", value => value.UserId, "Users", "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex(name: "IX_SavedEvents_EventId", table: "SavedEvents", column: "EventId");
        migrationBuilder.CreateIndex(name: "IX_SavedEvents_UserId_SavedAt", table: "SavedEvents", columns: new[] { "UserId", "SavedAt" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "SavedEvents");
}
