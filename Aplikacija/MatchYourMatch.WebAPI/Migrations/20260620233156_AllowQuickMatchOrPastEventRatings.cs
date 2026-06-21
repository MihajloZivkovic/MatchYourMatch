using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    public partial class AllowQuickMatchOrPastEventRatings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                ALTER TABLE `UserRatings` DROP FOREIGN KEY `FK_UserRatings_Events_EventId`;
                ALTER TABLE `UserRatings` MODIFY COLUMN `EventId` int NULL;
                ALTER TABLE `UserRatings` ADD CONSTRAINT `FK_UserRatings_Events_EventId`
                    FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DELETE FROM `UserRatings` WHERE `EventId` IS NULL;
                ALTER TABLE `UserRatings` DROP FOREIGN KEY `FK_UserRatings_Events_EventId`;
                ALTER TABLE `UserRatings` MODIFY COLUMN `EventId` int NOT NULL;
                ALTER TABLE `UserRatings` ADD CONSTRAINT `FK_UserRatings_Events_EventId`
                    FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE;
                """);
        }
    }
}
