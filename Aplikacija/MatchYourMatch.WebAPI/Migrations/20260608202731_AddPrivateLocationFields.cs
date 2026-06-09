using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddPrivateLocationFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "Latitude",
                table: "UserProfiles",
                type: "double",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LocationCity",
                table: "UserProfiles",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LocationCountry",
                table: "UserProfiles",
                type: "varchar(100)",
                maxLength: 100,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LocationDisplayName",
                table: "UserProfiles",
                type: "varchar(160)",
                maxLength: 160,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "LocationPrivacy",
                table: "UserProfiles",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "")
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<double>(
                name: "Longitude",
                table: "UserProfiles",
                type: "double",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Latitude",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "LocationCity",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "LocationCountry",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "LocationDisplayName",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "LocationPrivacy",
                table: "UserProfiles");

            migrationBuilder.DropColumn(
                name: "Longitude",
                table: "UserProfiles");
        }
    }
}
