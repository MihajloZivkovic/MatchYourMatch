using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    public partial class AddAccountSettingsAndProfileVisibility : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PendingEmail",
                table: "Users",
                type: "varchar(255)",
                maxLength: 255,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<string>(
                name: "PendingEmailVerificationCodeHash",
                table: "Users",
                type: "varchar(64)",
                maxLength: 64,
                nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingEmailVerificationCodeExpiresAt",
                table: "Users",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PendingEmailVerificationCodeSentAt",
                table: "Users",
                type: "datetime(6)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ProfileVisibility",
                table: "UserProfiles",
                type: "varchar(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "Standard")
                .Annotation("MySql:CharSet", "utf8mb4");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "PendingEmail", table: "Users");
            migrationBuilder.DropColumn(name: "PendingEmailVerificationCodeHash", table: "Users");
            migrationBuilder.DropColumn(name: "PendingEmailVerificationCodeExpiresAt", table: "Users");
            migrationBuilder.DropColumn(name: "PendingEmailVerificationCodeSentAt", table: "Users");
            migrationBuilder.DropColumn(name: "ProfileVisibility", table: "UserProfiles");
        }
    }
}
