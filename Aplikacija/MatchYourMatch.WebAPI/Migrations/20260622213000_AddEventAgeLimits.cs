using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260622213000_AddEventAgeLimits")]
public partial class AddEventAgeLimits : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(name: "MinAge", table: "Events", type: "int", nullable: true);
        migrationBuilder.AddColumn<int>(name: "MaxAge", table: "Events", type: "int", nullable: true);
        migrationBuilder.CreateIndex(name: "IX_Events_MinAge_MaxAge", table: "Events", columns: new[] { "MinAge", "MaxAge" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_Events_MinAge_MaxAge", table: "Events");
        migrationBuilder.DropColumn(name: "MinAge", table: "Events");
        migrationBuilder.DropColumn(name: "MaxAge", table: "Events");
    }
}
