using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace MatchYourMatch.WebAPI.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260621220000_AddAccountLifecycle")]
public partial class AddAccountLifecycle : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>(name: "DeactivatedAt", table: "Users", type: "datetime(6)", nullable: true);
        migrationBuilder.AddColumn<bool>(name: "HasPassword", table: "Users", type: "tinyint(1)", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<bool>(name: "IsDeactivated", table: "Users", type: "tinyint(1)", nullable: false, defaultValue: false);
        migrationBuilder.AddColumn<int>(name: "TokenVersion", table: "Users", type: "int", nullable: false, defaultValue: 0);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn(name: "DeactivatedAt", table: "Users");
        migrationBuilder.DropColumn(name: "HasPassword", table: "Users");
        migrationBuilder.DropColumn(name: "IsDeactivated", table: "Users");
        migrationBuilder.DropColumn(name: "TokenVersion", table: "Users");
    }
}
