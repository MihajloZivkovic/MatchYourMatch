using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260621160000_AddEmailVerification")]
    public partial class AddEmailVerification : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>("EmailConfirmed", "Users", "tinyint(1)", nullable: false, defaultValue: true);
            migrationBuilder.AddColumn<DateTime>("EmailConfirmedAt", "Users", "datetime(6)", nullable: true);
            migrationBuilder.AddColumn<string>("EmailVerificationCodeHash", "Users", "varchar(64)", maxLength: 64, nullable: true)
                .Annotation("MySql:CharSet", "utf8mb4");
            migrationBuilder.AddColumn<DateTime>("EmailVerificationCodeExpiresAt", "Users", "datetime(6)", nullable: true);
            migrationBuilder.AddColumn<DateTime>("EmailVerificationCodeSentAt", "Users", "datetime(6)", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn("EmailConfirmed", "Users");
            migrationBuilder.DropColumn("EmailConfirmedAt", "Users");
            migrationBuilder.DropColumn("EmailVerificationCodeHash", "Users");
            migrationBuilder.DropColumn("EmailVerificationCodeExpiresAt", "Users");
            migrationBuilder.DropColumn("EmailVerificationCodeSentAt", "Users");
        }
    }
}
