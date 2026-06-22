using System;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddQuickMatchRequestsAndAgeRanges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "PreferredMaxAge",
                table: "QuickMatchPosts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "PreferredMinAge",
                table: "QuickMatchPosts",
                type: "int",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "QuickMatchRequests",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                    QuickMatchPostId = table.Column<int>(type: "int", nullable: false),
                    RequesterUserId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false)
                        .Annotation("MySql:CharSet", "utf8mb4"),
                    CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false),
                    RespondedAt = table.Column<DateTime>(type: "datetime(6)", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_QuickMatchRequests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_QuickMatchRequests_QuickMatchPosts_QuickMatchPostId",
                        column: x => x.QuickMatchPostId,
                        principalTable: "QuickMatchPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_QuickMatchRequests_Users_RequesterUserId",
                        column: x => x.RequesterUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                })
                .Annotation("MySql:CharSet", "utf8mb4");

            migrationBuilder.CreateIndex(
                name: "IX_QuickMatchRequests_QuickMatchPostId_RequesterUserId",
                table: "QuickMatchRequests",
                columns: new[] { "QuickMatchPostId", "RequesterUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_QuickMatchRequests_QuickMatchPostId_Status",
                table: "QuickMatchRequests",
                columns: new[] { "QuickMatchPostId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_QuickMatchRequests_RequesterUserId",
                table: "QuickMatchRequests",
                column: "RequesterUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "QuickMatchRequests");

            migrationBuilder.DropColumn(
                name: "PreferredMaxAge",
                table: "QuickMatchPosts");

            migrationBuilder.DropColumn(
                name: "PreferredMinAge",
                table: "QuickMatchPosts");

        }
    }
}
