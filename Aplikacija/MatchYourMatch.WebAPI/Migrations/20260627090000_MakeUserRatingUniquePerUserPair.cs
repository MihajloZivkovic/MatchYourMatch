using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations;

public partial class MakeUserRatingUniquePerUserPair : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            SET @ratingEventFkExists := (
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings'
                  AND CONSTRAINT_NAME = 'FK_UserRatings_Events_EventId'
            );
            SET @statement := IF(
                @ratingEventFkExists > 0,
                'ALTER TABLE `UserRatings` DROP FOREIGN KEY `FK_UserRatings_Events_EventId`',
                'SELECT 1'
            );
            PREPARE stmt FROM @statement;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;

            ALTER TABLE `UserRatings` ADD CONSTRAINT `FK_UserRatings_Events_EventId`
                FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE SET NULL;

            SET @oldUserRatingIndexExists := (
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings'
                  AND INDEX_NAME = 'IX_UserRatings_RaterUserId_RatedUserId_EventId'
            );
            SET @statement := IF(
                @oldUserRatingIndexExists > 0,
                'ALTER TABLE `UserRatings` DROP INDEX `IX_UserRatings_RaterUserId_RatedUserId_EventId`',
                'SELECT 1'
            );
            PREPARE stmt FROM @statement;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;

            DELETE oldRating FROM `UserRatings` oldRating
            INNER JOIN `UserRatings` newerRating
                ON newerRating.`RaterUserId` = oldRating.`RaterUserId`
                AND newerRating.`RatedUserId` = oldRating.`RatedUserId`
                AND (
                    COALESCE(newerRating.`UpdatedAt`, newerRating.`CreatedAt`) > COALESCE(oldRating.`UpdatedAt`, oldRating.`CreatedAt`)
                    OR (
                        COALESCE(newerRating.`UpdatedAt`, newerRating.`CreatedAt`) = COALESCE(oldRating.`UpdatedAt`, oldRating.`CreatedAt`)
                        AND newerRating.`Id` > oldRating.`Id`
                    )
                );

            SET @newUserRatingIndexExists := (
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings'
                  AND INDEX_NAME = 'IX_UserRatings_RaterUserId_RatedUserId'
            );
            SET @statement := IF(
                @newUserRatingIndexExists = 0,
                'ALTER TABLE `UserRatings` ADD UNIQUE INDEX `IX_UserRatings_RaterUserId_RatedUserId` (`RaterUserId`, `RatedUserId`)',
                'SELECT 1'
            );
            PREPARE stmt FROM @statement;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            SET @ratingEventFkExists := (
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
                WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings'
                  AND CONSTRAINT_NAME = 'FK_UserRatings_Events_EventId'
            );
            SET @statement := IF(
                @ratingEventFkExists > 0,
                'ALTER TABLE `UserRatings` DROP FOREIGN KEY `FK_UserRatings_Events_EventId`',
                'SELECT 1'
            );
            PREPARE stmt FROM @statement;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;

            ALTER TABLE `UserRatings` ADD CONSTRAINT `FK_UserRatings_Events_EventId`
                FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE;

            SET @newUserRatingIndexExists := (
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings'
                  AND INDEX_NAME = 'IX_UserRatings_RaterUserId_RatedUserId'
            );
            SET @statement := IF(
                @newUserRatingIndexExists > 0,
                'ALTER TABLE `UserRatings` DROP INDEX `IX_UserRatings_RaterUserId_RatedUserId`',
                'SELECT 1'
            );
            PREPARE stmt FROM @statement;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;

            SET @oldUserRatingIndexExists := (
                SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings'
                  AND INDEX_NAME = 'IX_UserRatings_RaterUserId_RatedUserId_EventId'
            );
            SET @statement := IF(
                @oldUserRatingIndexExists = 0,
                'ALTER TABLE `UserRatings` ADD UNIQUE INDEX `IX_UserRatings_RaterUserId_RatedUserId_EventId` (`RaterUserId`, `RatedUserId`, `EventId`)',
                'SELECT 1'
            );
            PREPARE stmt FROM @statement;
            EXECUTE stmt;
            DEALLOCATE PREPARE stmt;
            """);
    }
}
