using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260621120000_AddProfileTags")]
    public partial class AddProfileTags : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ExploringTagsJson",
                table: "UserProfiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LittleThingsJson",
                table: "UserProfiles",
                type: "longtext",
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "ExploringTagsJson", table: "UserProfiles");
            migrationBuilder.DropColumn(name: "LittleThingsJson", table: "UserProfiles");
        }
    }
}
