using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))]
    [Migration("20260620215947_AddUserRatings")]
    public partial class AddUserRatings : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS `UserRatings` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `RaterUserId` int NOT NULL,
                    `RatedUserId` int NOT NULL,
                    `EventId` int NOT NULL,
                    `Rating` decimal(2,1) NOT NULL,
                    `CreatedAt` datetime(6) NOT NULL,
                    `UpdatedAt` datetime(6) NULL,
                    CONSTRAINT `PK_UserRatings` PRIMARY KEY (`Id`),
                    CONSTRAINT `FK_UserRatings_Events_EventId` FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE,
                    CONSTRAINT `FK_UserRatings_Users_RatedUserId` FOREIGN KEY (`RatedUserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
                    CONSTRAINT `FK_UserRatings_Users_RaterUserId` FOREIGN KEY (`RaterUserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
                    INDEX `IX_UserRatings_EventId` (`EventId`),
                    INDEX `IX_UserRatings_RatedUserId` (`RatedUserId`),
                    UNIQUE INDEX `IX_UserRatings_RaterUserId_RatedUserId_EventId` (`RaterUserId`, `RatedUserId`, `EventId`)
                ) CHARACTER SET=utf8mb4;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("DROP TABLE IF EXISTS `UserRatings`;");
    }
}
