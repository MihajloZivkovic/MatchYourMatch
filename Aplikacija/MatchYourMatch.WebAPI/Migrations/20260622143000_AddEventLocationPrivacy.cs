using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260622143000_AddEventLocationPrivacy")]
    public partial class AddEventLocationPrivacy : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(name: "Location", table: "Events", type: "varchar(500)", maxLength: 500, nullable: false, oldClrType: typeof(string), oldType: "longtext")
                .Annotation("MySql:CharSet", "utf8mb4").OldAnnotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<double>(name: "Latitude", table: "Events", type: "double", nullable: true);
            migrationBuilder.AddColumn<double>(name: "Longitude", table: "Events", type: "double", nullable: true);
            migrationBuilder.AddColumn<string>(name: "LocationCity", table: "Events", type: "varchar(100)", maxLength: 100, nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<string>(name: "LocationCountry", table: "Events", type: "varchar(100)", maxLength: 100, nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<bool>(name: "ShowFullAddress", table: "Events", type: "tinyint(1)", nullable: false, defaultValue: false);

            // Legacy values are generally city-level locations; keep them visible without opting into full-address display.
            migrationBuilder.Sql("UPDATE `Events` SET `LocationCity` = `Location` WHERE `LocationCity` IS NULL;");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "Latitude", table: "Events");
            migrationBuilder.DropColumn(name: "Longitude", table: "Events");
            migrationBuilder.DropColumn(name: "LocationCity", table: "Events");
            migrationBuilder.DropColumn(name: "LocationCountry", table: "Events");
            migrationBuilder.DropColumn(name: "ShowFullAddress", table: "Events");
            migrationBuilder.AlterColumn<string>(name: "Location", table: "Events", type: "longtext", nullable: false, oldClrType: typeof(string), oldType: "varchar(500)", oldMaxLength: 500)
                .Annotation("MySql:CharSet", "utf8mb4").OldAnnotation("MySql:CharSet", "utf8mb4");
        }
    }
}
