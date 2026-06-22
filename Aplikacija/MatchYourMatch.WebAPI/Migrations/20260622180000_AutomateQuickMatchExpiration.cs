using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260622180000_AutomateQuickMatchExpiration")]
public partial class AutomateQuickMatchExpiration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>(name: "StartsAtUtc", table: "QuickMatchPosts", type: "datetime(6)", nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "EndsAtUtc", table: "QuickMatchPosts", type: "datetime(6)", nullable: true);
        migrationBuilder.AddColumn<DateTime>(name: "ExpiredAt", table: "QuickMatchPosts", type: "datetime(6)", nullable: true);

        migrationBuilder.Sql("""
            UPDATE `QuickMatchPosts`
            SET `StartsAtUtc` = DATE_ADD(TIMESTAMP(`Date`, `StartTime`), INTERVAL TIMESTAMPDIFF(MINUTE, NOW(), UTC_TIMESTAMP()) MINUTE),
                `EndsAtUtc` = DATE_ADD(
                    TIMESTAMP(DATE_ADD(`Date`, INTERVAL (`EndTime` <= `StartTime`) DAY), `EndTime`),
                    INTERVAL TIMESTAMPDIFF(MINUTE, NOW(), UTC_TIMESTAMP()) MINUTE);

            UPDATE `QuickMatchPosts`
            SET `IsActive` = 0, `ExpiredAt` = UTC_TIMESTAMP(6)
            WHERE `IsActive` = 1 AND `EndsAtUtc` <= UTC_TIMESTAMP(6);

            UPDATE `QuickMatchRequests` request
            INNER JOIN `QuickMatchPosts` post ON post.`Id` = request.`QuickMatchPostId`
            SET request.`Status` = 'Expired', request.`RespondedAt` = UTC_TIMESTAMP(6)
            WHERE request.`Status` = 'Pending' AND post.`EndsAtUtc` <= UTC_TIMESTAMP(6);
            """);

        migrationBuilder.AlterColumn<DateTime>(name: "StartsAtUtc", table: "QuickMatchPosts", type: "datetime(6)", nullable: false);
        migrationBuilder.AlterColumn<DateTime>(name: "EndsAtUtc", table: "QuickMatchPosts", type: "datetime(6)", nullable: false);
        migrationBuilder.CreateIndex(name: "IX_QuickMatchPosts_IsActive_EndsAtUtc", table: "QuickMatchPosts", columns: new[] { "IsActive", "EndsAtUtc" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(name: "IX_QuickMatchPosts_IsActive_EndsAtUtc", table: "QuickMatchPosts");
        migrationBuilder.DropColumn(name: "ExpiredAt", table: "QuickMatchPosts");
        migrationBuilder.DropColumn(name: "EndsAtUtc", table: "QuickMatchPosts");
        migrationBuilder.DropColumn(name: "StartsAtUtc", table: "QuickMatchPosts");
    }
}
