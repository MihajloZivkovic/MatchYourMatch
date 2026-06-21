using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations
{
    public partial class AddUserRatingsAndQuickMatchUserMatches : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE TABLE IF NOT EXISTS `UserMatches` (
                    `Id` int NOT NULL AUTO_INCREMENT,
                    `UserAId` int NOT NULL,
                    `UserBId` int NOT NULL,
                    `Source` varchar(30) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'QuickMatch',
                    `CreatedAt` datetime(6) NOT NULL,
                    `IsActive` tinyint(1) NOT NULL DEFAULT 1,
                    `CompatibilityScore` int NULL,
                    CONSTRAINT `PK_UserMatches` PRIMARY KEY (`Id`),
                    CONSTRAINT `FK_UserMatches_Users_UserAId` FOREIGN KEY (`UserAId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
                    CONSTRAINT `FK_UserMatches_Users_UserBId` FOREIGN KEY (`UserBId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
                    UNIQUE INDEX `IX_UserMatches_UserAId_UserBId_Source` (`UserAId`, `UserBId`, `Source`),
                    INDEX `IX_UserMatches_UserBId` (`UserBId`)
                ) CHARACTER SET=utf8mb4;
                """);
        }

        protected override void Down(MigrationBuilder migrationBuilder) =>
            migrationBuilder.Sql("DROP TABLE IF EXISTS `UserMatches`;");
    }
}
