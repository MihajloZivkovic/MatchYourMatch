using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.Services;
using MatchYourMatch.WebAPI.Services.Interfaces;
using MatchYourMatch.WebAPI.Middleware;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Connections;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Security.Claims;
using System.Text;

DotNetEnv.Env.Load();
var frontendEnvPath = Path.GetFullPath(Path.Combine(
    Directory.GetCurrentDirectory(),
    "..", "MatchYourMatch.Client", "MatchYourMatchFront", ".env"));
if (File.Exists(frontendEnvPath))
{
    DotNetEnv.Env.Load(frontendEnvPath);
}
var schemaOnly = string.Equals(Environment.GetEnvironmentVariable("MYM_SCHEMA_ONLY"), "1", StringComparison.Ordinal);
using var backendInstanceMutex = new Mutex(
    initiallyOwned: true,
    name: "Local\\MatchYourMatch.WebAPI",
    createdNew: out var isFirstBackendInstance);

if (!isFirstBackendInstance && !schemaOnly)
{
    Console.Error.WriteLine(
        "MatchYourMatch WebAPI is already running. Use the existing instance instead of starting another one.");
    return;
}

var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

var dataProtectionKeysPath = Path.Combine(builder.Environment.ContentRootPath, "DataProtectionKeys");
Directory.CreateDirectory(dataProtectionKeysPath);
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath))
    .SetApplicationName("MatchYourMatch.WebAPI");

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseMySql(
        builder.Configuration.GetConnectionString("DefaultConnection"),
        ServerVersion.AutoDetect(
            builder.Configuration.GetConnectionString("DefaultConnection"))
    ));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
            ValidAudience = builder.Configuration["JwtSettings:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Secret"]!))
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var idValue = context.Principal?.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                var versionValue = context.Principal?.FindFirst("tokenVersion")?.Value;
                if (!int.TryParse(idValue, out var userId) || !int.TryParse(versionValue, out var tokenVersion))
                {
                    context.Fail("Session is no longer valid.");
                    return;
                }
                var db = context.HttpContext.RequestServices.GetRequiredService<AppDbContext>();
                var valid = await db.Users.AsNoTracking().AnyAsync(user => user.Id == userId && user.IsActive &&
                    !user.IsDeactivated && user.TokenVersion == tokenVersion);
                if (!valid) context.Fail("Session is no longer valid.");
            },
            OnChallenge = async context =>
            {
                if (context.Response.HasStarted) return;
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                context.Response.ContentType = "application/json";
                await context.Response.WriteAsJsonAsync(new
                {
                    code = "SESSION_EXPIRED",
                    message = "Your session has expired."
                });
            }
        };
    });

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAccountService, AccountService>();
builder.Services.AddScoped<IUserProfilesService, UserProfilesService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddSingleton<IMessageAttachmentStorage, MessageAttachmentStorage>();
builder.Services.AddScoped<IQuickMatchService, QuickMatchService>();
builder.Services.AddScoped<IQuickMatchExpirationService, QuickMatchExpirationService>();
builder.Services.AddHostedService<QuickMatchExpirationWorker>();
builder.Services.AddScoped<IDeepMatchService, DeepMatchService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddHttpClient<IGeocodingService, GeocodingService>();
builder.Services.AddScoped<IFollowService, FollowService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IEventInviteService, EventInviteService>();
builder.Services.AddScoped<IUserRatingService, UserRatingService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddHttpClient();
builder.Services.AddScoped<GoogleTokenValidator>();
builder.Services.AddScoped<FacebookTokenValidator>();
builder.Services.AddScoped<MicrosoftTokenValidator>();

builder.Services.AddAuthorization();
builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme()
    {
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "Bearer"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'Users'
              AND COLUMN_NAME = 'ResetToken'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `Users` ADD COLUMN `ResetToken` longtext CHARACTER SET utf8mb4 NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'Users'
              AND COLUMN_NAME = 'ResetTokenExpiry'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `Users` ADD COLUMN `ResetTokenExpiry` datetime(6) NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
#pragma warning disable EF1002
#pragma warning disable EF1002
    foreach (var column in new[]
    {
        (Name: "EmailConfirmed", Sql: "ALTER TABLE `Users` ADD COLUMN `EmailConfirmed` tinyint(1) NOT NULL DEFAULT 1"),
        (Name: "EmailConfirmedAt", Sql: "ALTER TABLE `Users` ADD COLUMN `EmailConfirmedAt` datetime(6) NULL"),
        (Name: "EmailVerificationCodeHash", Sql: "ALTER TABLE `Users` ADD COLUMN `EmailVerificationCodeHash` varchar(64) NULL"),
        (Name: "EmailVerificationCodeExpiresAt", Sql: "ALTER TABLE `Users` ADD COLUMN `EmailVerificationCodeExpiresAt` datetime(6) NULL"),
        (Name: "EmailVerificationCodeSentAt", Sql: "ALTER TABLE `Users` ADD COLUMN `EmailVerificationCodeSentAt` datetime(6) NULL"),
        (Name: "IsDeactivated", Sql: "ALTER TABLE `Users` ADD COLUMN `IsDeactivated` tinyint(1) NOT NULL DEFAULT 0"),
        (Name: "DeactivatedAt", Sql: "ALTER TABLE `Users` ADD COLUMN `DeactivatedAt` datetime(6) NULL"),
        (Name: "TokenVersion", Sql: "ALTER TABLE `Users` ADD COLUMN `TokenVersion` int NOT NULL DEFAULT 0"),
        (Name: "HasPassword", Sql: "ALTER TABLE `Users` ADD COLUMN `HasPassword` tinyint(1) NOT NULL DEFAULT 1")
    })
    {
        db.Database.ExecuteSqlRaw($"""
            SET @columnExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Users' AND COLUMN_NAME = '{column.Name}');
            SET @statement := IF(@columnExists = 0, '{column.Sql}', 'SELECT 1');
            PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;
            """);
    }
#pragma warning restore EF1002
#pragma warning restore EF1002
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `Follows` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `FollowerId` int NOT NULL,
            `FollowingId` int NOT NULL,
            CONSTRAINT `PK_Follows` PRIMARY KEY (`Id`),
            CONSTRAINT `FK_Follows_Users_FollowerId` FOREIGN KEY (`FollowerId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
            CONSTRAINT `FK_Follows_Users_FollowingId` FOREIGN KEY (`FollowingId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
            UNIQUE INDEX `IX_Follows_FollowerId_FollowingId` (`FollowerId`, `FollowingId`),
            INDEX `IX_Follows_FollowingId` (`FollowingId`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `ExternalLogins` (
            `Id` int NOT NULL AUTO_INCREMENT, `UserId` int NOT NULL,
            `Provider` varchar(30) NOT NULL, `ProviderUserId` varchar(200) NOT NULL,
            `ProviderEmail` longtext NULL, `CreatedAt` datetime(6) NOT NULL,
            CONSTRAINT `PK_ExternalLogins` PRIMARY KEY (`Id`),
            CONSTRAINT `FK_ExternalLogins_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE,
            UNIQUE INDEX `IX_ExternalLogins_Provider_ProviderUserId` (`Provider`,`ProviderUserId`),
            INDEX `IX_ExternalLogins_UserId` (`UserId`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @oldFollowIndexExists := (
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Follows'
              AND INDEX_NAME = 'IX_Follows_FollowerId'
        );
        SET @statement := IF(
            @oldFollowIndexExists > 0,
            'ALTER TABLE `Follows` DROP INDEX `IX_Follows_FollowerId`',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;

        DELETE duplicateFollow
        FROM `Follows` duplicateFollow
        INNER JOIN `Follows` originalFollow
            ON duplicateFollow.`FollowerId` = originalFollow.`FollowerId`
           AND duplicateFollow.`FollowingId` = originalFollow.`FollowingId`
           AND duplicateFollow.`Id` > originalFollow.`Id`;

        SET @followUniqueIndexExists := (
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Follows'
              AND INDEX_NAME = 'IX_Follows_FollowerId_FollowingId'
        );
        SET @statement := IF(
            @followUniqueIndexExists = 0,
            'CREATE UNIQUE INDEX `IX_Follows_FollowerId_FollowingId` ON `Follows` (`FollowerId`, `FollowingId`)',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
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
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `UserAppSettings` (
            `Id` int NOT NULL AUTO_INCREMENT, `UserId` int NOT NULL,
            `MaximumDistanceKm` int NULL, `ShowMeInQuickMatch` tinyint(1) NOT NULL DEFAULT 1,
            `ShowMeInDeepMatch` tinyint(1) NOT NULL DEFAULT 1, `PreferPeopleNearby` tinyint(1) NOT NULL DEFAULT 1,
            `MinAge` int NULL, `MaxAge` int NULL,
            `WhoCanMessageMe` varchar(30) NOT NULL DEFAULT 'MatchesOnly',
            `AllowEventInvitesFrom` varchar(30) NOT NULL DEFAULT 'PeopleIFollow',
            `AllowGroupChatInvitesFrom` varchar(30) NOT NULL DEFAULT 'MatchesOnly',
            `NotifyEventInvites` tinyint(1) NOT NULL DEFAULT 1, `NotifyNewFollowers` tinyint(1) NOT NULL DEFAULT 1,
            `NotifyQuickMatches` tinyint(1) NOT NULL DEFAULT 1, `NotifyChatMessages` tinyint(1) NOT NULL DEFAULT 1,
            `NotifyGroupMessages` tinyint(1) NOT NULL DEFAULT 1, `NotifyEventDiscussionReplies` tinyint(1) NOT NULL DEFAULT 1,
            `NotifyNewEventNearby` tinyint(1) NOT NULL DEFAULT 1, `NotifyEventStartingSoon` tinyint(1) NOT NULL DEFAULT 1,
            `NotifyNewMatchNearby` tinyint(1) NOT NULL DEFAULT 0,
            CONSTRAINT `PK_UserAppSettings` PRIMARY KEY (`Id`),
            CONSTRAINT `FK_UserAppSettings_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE,
            UNIQUE INDEX `IX_UserAppSettings_UserId` (`UserId`)
        ) CHARACTER SET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `BlockedUsers` (
            `Id` int NOT NULL AUTO_INCREMENT, `BlockerUserId` int NOT NULL, `BlockedUserId` int NOT NULL, `CreatedAt` datetime(6) NOT NULL,
            CONSTRAINT `PK_BlockedUsers` PRIMARY KEY (`Id`), UNIQUE INDEX `IX_BlockedUsers_BlockerUserId_BlockedUserId` (`BlockerUserId`,`BlockedUserId`)
        ) CHARACTER SET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `HiddenProfiles` (
            `Id` int NOT NULL AUTO_INCREMENT, `UserId` int NOT NULL, `HiddenUserId` int NOT NULL, `CreatedAt` datetime(6) NOT NULL,
            CONSTRAINT `PK_HiddenProfiles` PRIMARY KEY (`Id`), UNIQUE INDEX `IX_HiddenProfiles_UserId_HiddenUserId` (`UserId`,`HiddenUserId`)
        ) CHARACTER SET=utf8mb4;
        """);
#pragma warning disable EF1002 // The interpolated identifiers and DDL below come only from this fixed local list.
    foreach (var profileColumn in new[]
    {
        (Name: "FullName", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `FullName` varchar(160) NULL"),
        (Name: "ShowFullName", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `ShowFullName` tinyint(1) NOT NULL DEFAULT 0"),
        (Name: "DateOfBirth", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `DateOfBirth` date NULL"),
        (Name: "ShowAge", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `ShowAge` tinyint(1) NOT NULL DEFAULT 0"),
        (Name: "LittleThingsJson", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `LittleThingsJson` longtext NULL"),
        (Name: "ExploringTagsJson", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `ExploringTagsJson` longtext NULL")
        ,(Name: "FavoriteActivitiesJson", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `FavoriteActivitiesJson` longtext NULL")
        ,(Name: "SocialEnergy", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `SocialEnergy` int NULL")
        ,(Name: "ConversationStyle", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `ConversationStyle` varchar(80) NULL")
        ,(Name: "LookingForJson", Sql: "ALTER TABLE `UserProfiles` ADD COLUMN `LookingForJson` longtext NULL")
    })
    {
        db.Database.ExecuteSqlRaw($"""
            SET @columnExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserProfiles' AND COLUMN_NAME = '{profileColumn.Name}');
            SET @statement := IF(@columnExists = 0, '{profileColumn.Sql}', 'SELECT 1');
            PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;
            """);
    }
#pragma warning restore EF1002
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `ChatConversations` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `UserAId` int NULL,
            `UserBId` int NULL,
            `IsGroup` tinyint(1) NOT NULL DEFAULT 0,
            `GroupName` varchar(120) CHARACTER SET utf8mb4 NULL,
            `EventId` int NULL,
            `CreatedByUserId` int NULL,
            `CreatedAt` datetime(6) NOT NULL,
            `LastMessageAt` datetime(6) NULL,
            `IsHiddenForUserA` tinyint(1) NOT NULL DEFAULT 0,
            `IsHiddenForUserB` tinyint(1) NOT NULL DEFAULT 0,
            CONSTRAINT `PK_ChatConversations` PRIMARY KEY (`Id`),
            UNIQUE INDEX `IX_ChatConversations_UserAId_UserBId` (`UserAId`, `UserBId`),
            INDEX `IX_ChatConversations_CreatedByUserId` (`CreatedByUserId`),
            INDEX `IX_ChatConversations_EventId` (`EventId`),
            INDEX `IX_ChatConversations_UserBId` (`UserBId`),
            CONSTRAINT `FK_ChatConversations_Users_CreatedByUserId` FOREIGN KEY (`CreatedByUserId`) REFERENCES `Users` (`Id`) ON DELETE SET NULL,
            CONSTRAINT `FK_ChatConversations_Users_UserAId` FOREIGN KEY (`UserAId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
            CONSTRAINT `FK_ChatConversations_Users_UserBId` FOREIGN KEY (`UserBId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        ALTER TABLE `ChatConversations` MODIFY COLUMN `UserAId` int NULL;
        ALTER TABLE `ChatConversations` MODIFY COLUMN `UserBId` int NULL;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversations'
              AND COLUMN_NAME = 'IsGroup'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatConversations` ADD COLUMN `IsGroup` tinyint(1) NOT NULL DEFAULT 0',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversations'
              AND COLUMN_NAME = 'GroupName'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatConversations` ADD COLUMN `GroupName` varchar(120) CHARACTER SET utf8mb4 NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversations'
              AND COLUMN_NAME = 'GroupPhoto'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatConversations` ADD COLUMN `GroupPhoto` longtext CHARACTER SET utf8mb4 NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        ALTER TABLE `ChatConversations` MODIFY COLUMN `GroupPhoto` longtext CHARACTER SET utf8mb4 NULL;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversations'
              AND COLUMN_NAME = 'CreatedByUserId'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatConversations` ADD COLUMN `CreatedByUserId` int NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversations'
              AND COLUMN_NAME = 'IsHiddenForUserA'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatConversations` ADD COLUMN `IsHiddenForUserA` tinyint(1) NOT NULL DEFAULT 0',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversations'
              AND COLUMN_NAME = 'IsHiddenForUserB'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatConversations` ADD COLUMN `IsHiddenForUserB` tinyint(1) NOT NULL DEFAULT 0',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversations'
              AND COLUMN_NAME = 'EventId'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatConversations` ADD COLUMN `EventId` int NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @indexExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversations'
              AND INDEX_NAME = 'IX_ChatConversations_EventId'
        );
        SET @statement := IF(
            @indexExists = 0,
            'CREATE INDEX `IX_ChatConversations_EventId` ON `ChatConversations` (`EventId`)',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `ChatMessages` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `ConversationId` int NOT NULL,
            `SenderId` int NOT NULL,
            `ReceiverId` int NULL,
            `Body` varchar(2000) CHARACTER SET utf8mb4 NOT NULL,
            `CreatedAt` datetime(6) NOT NULL,
            `ReadAt` datetime(6) NULL,
            `IsDeletedForSender` tinyint(1) NOT NULL,
            `IsDeletedForReceiver` tinyint(1) NOT NULL,
            CONSTRAINT `PK_ChatMessages` PRIMARY KEY (`Id`),
            INDEX `IX_ChatMessages_ConversationId_CreatedAt` (`ConversationId`, `CreatedAt`),
            INDEX `IX_ChatMessages_ReceiverId` (`ReceiverId`),
            INDEX `IX_ChatMessages_SenderId` (`SenderId`),
            CONSTRAINT `FK_ChatMessages_ChatConversations_ConversationId` FOREIGN KEY (`ConversationId`) REFERENCES `ChatConversations` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_ChatMessages_Users_ReceiverId` FOREIGN KEY (`ReceiverId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
            CONSTRAINT `FK_ChatMessages_Users_SenderId` FOREIGN KEY (`SenderId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        ALTER TABLE `ChatMessages` MODIFY COLUMN `ReceiverId` int NULL;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatMessages'
              AND COLUMN_NAME = 'EditedAt'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatMessages` ADD COLUMN `EditedAt` datetime(6) NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `ChatConversationMembers` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `ConversationId` int NOT NULL,
            `UserId` int NOT NULL,
            `JoinedAt` datetime(6) NOT NULL,
            `LeftAt` datetime(6) NULL,
            `IsHidden` tinyint(1) NOT NULL DEFAULT 0,
            `IsMuted` tinyint(1) NOT NULL DEFAULT 0,
            `LastReadAt` datetime(6) NULL,
            `Role` varchar(30) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'Member',
            CONSTRAINT `PK_ChatConversationMembers` PRIMARY KEY (`Id`),
            UNIQUE INDEX `IX_ChatConversationMembers_ConversationId_UserId` (`ConversationId`, `UserId`),
            INDEX `IX_ChatConversationMembers_UserId` (`UserId`),
            CONSTRAINT `FK_ChatConversationMembers_ChatConversations_ConversationId` FOREIGN KEY (`ConversationId`) REFERENCES `ChatConversations` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_ChatConversationMembers_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `ChatMessageReactions` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `MessageId` int NOT NULL,
            `UserId` int NOT NULL,
            `Emoji` varchar(16) CHARACTER SET utf8mb4 NOT NULL,
            `CreatedAt` datetime(6) NOT NULL,
            CONSTRAINT `PK_ChatMessageReactions` PRIMARY KEY (`Id`),
            UNIQUE INDEX `IX_ChatMessageReactions_MessageId_UserId` (`MessageId`, `UserId`),
            INDEX `IX_ChatMessageReactions_UserId` (`UserId`),
            CONSTRAINT `FK_ChatMessageReactions_ChatMessages_MessageId` FOREIGN KEY (`MessageId`) REFERENCES `ChatMessages` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_ChatMessageReactions_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatConversationMembers'
              AND COLUMN_NAME = 'IsMuted'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatConversationMembers` ADD COLUMN `IsMuted` tinyint(1) NOT NULL DEFAULT 0',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `ChatMessageUserDeletions` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `MessageId` int NOT NULL,
            `UserId` int NOT NULL,
            `DeletedAt` datetime(6) NOT NULL,
            CONSTRAINT `PK_ChatMessageUserDeletions` PRIMARY KEY (`Id`),
            UNIQUE INDEX `IX_ChatMessageUserDeletions_MessageId_UserId` (`MessageId`, `UserId`),
            INDEX `IX_ChatMessageUserDeletions_UserId` (`UserId`),
            CONSTRAINT `FK_ChatMessageUserDeletions_ChatMessages_MessageId` FOREIGN KEY (`MessageId`) REFERENCES `ChatMessages` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_ChatMessageUserDeletions_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatMessages'
              AND COLUMN_NAME = 'IsDeletedForEveryone'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatMessages` ADD COLUMN `IsDeletedForEveryone` tinyint(1) NOT NULL DEFAULT 0',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'ChatMessages'
              AND COLUMN_NAME = 'DeletedAt'
        );
        SET @statement := IF(
            @columnExists = 0,
            'ALTER TABLE `ChatMessages` ADD COLUMN `DeletedAt` datetime(6) NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `Events` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `Title` longtext CHARACTER SET utf8mb4 NOT NULL,
            `OrganizerId` int NULL,
            `InterestId` int NULL,
            `Date` date NOT NULL,
            `Time` time(6) NOT NULL,
            `Location` longtext CHARACTER SET utf8mb4 NOT NULL,
            `MaxAttendees` int NOT NULL,
            `RequiresParticipantApproval` tinyint(1) NOT NULL DEFAULT 0,
            `Description` longtext CHARACTER SET utf8mb4 NULL,
            `ImageUrl` longtext CHARACTER SET utf8mb4 NULL,
            CONSTRAINT `PK_Events` PRIMARY KEY (`Id`),
            INDEX `IX_Events_InterestId` (`InterestId`),
            INDEX `IX_Events_OrganizerId` (`OrganizerId`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        SET @columnExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QuickMatchPosts' AND COLUMN_NAME = 'PreferredMinAge');
        SET @statement := IF(@columnExists = 0,
            'ALTER TABLE `QuickMatchPosts` ADD COLUMN `PreferredMinAge` int NULL', 'SELECT 1');
        PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

        SET @columnExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QuickMatchPosts' AND COLUMN_NAME = 'PreferredMaxAge');
        SET @statement := IF(@columnExists = 0,
            'ALTER TABLE `QuickMatchPosts` ADD COLUMN `PreferredMaxAge` int NULL', 'SELECT 1');
        PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

        SET @columnExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QuickMatchPosts' AND COLUMN_NAME = 'StartsAtUtc');
        SET @statement := IF(@columnExists = 0,
            'ALTER TABLE `QuickMatchPosts` ADD COLUMN `StartsAtUtc` datetime(6) NULL', 'SELECT 1');
        PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

        SET @columnExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QuickMatchPosts' AND COLUMN_NAME = 'EndsAtUtc');
        SET @statement := IF(@columnExists = 0,
            'ALTER TABLE `QuickMatchPosts` ADD COLUMN `EndsAtUtc` datetime(6) NULL', 'SELECT 1');
        PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

        SET @columnExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QuickMatchPosts' AND COLUMN_NAME = 'ExpiredAt');
        SET @statement := IF(@columnExists = 0,
            'ALTER TABLE `QuickMatchPosts` ADD COLUMN `ExpiredAt` datetime(6) NULL', 'SELECT 1');
        PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;

        CREATE TABLE IF NOT EXISTS `QuickMatchRequests` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `QuickMatchPostId` int NOT NULL,
            `RequesterUserId` int NOT NULL,
            `Status` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'Pending',
            `CreatedAt` datetime(6) NOT NULL,
            `RespondedAt` datetime(6) NULL,
            CONSTRAINT `PK_QuickMatchRequests` PRIMARY KEY (`Id`),
            CONSTRAINT `FK_QuickMatchRequests_QuickMatchPosts_QuickMatchPostId` FOREIGN KEY (`QuickMatchPostId`) REFERENCES `QuickMatchPosts` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_QuickMatchRequests_Users_RequesterUserId` FOREIGN KEY (`RequesterUserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
            UNIQUE INDEX `IX_QuickMatchRequests_QuickMatchPostId_RequesterUserId` (`QuickMatchPostId`, `RequesterUserId`),
            INDEX `IX_QuickMatchRequests_QuickMatchPostId_Status` (`QuickMatchPostId`, `Status`),
            INDEX `IX_QuickMatchRequests_RequesterUserId` (`RequesterUserId`)
        ) CHARACTER SET=utf8mb4;

        UPDATE `QuickMatchPosts`
        SET `StartsAtUtc` = DATE_ADD(TIMESTAMP(`Date`, `StartTime`), INTERVAL TIMESTAMPDIFF(MINUTE, NOW(), UTC_TIMESTAMP()) MINUTE),
            `EndsAtUtc` = DATE_ADD(TIMESTAMP(DATE_ADD(`Date`, INTERVAL (`EndTime` <= `StartTime`) DAY), `EndTime`), INTERVAL TIMESTAMPDIFF(MINUTE, NOW(), UTC_TIMESTAMP()) MINUTE)
        WHERE `StartsAtUtc` IS NULL OR `EndsAtUtc` IS NULL;

        UPDATE `QuickMatchPosts`
        SET `IsActive` = 0, `ExpiredAt` = COALESCE(`ExpiredAt`, UTC_TIMESTAMP(6))
        WHERE `IsActive` = 1 AND `EndsAtUtc` <= UTC_TIMESTAMP(6);

        UPDATE `QuickMatchRequests` request
        INNER JOIN `QuickMatchPosts` post ON post.`Id` = request.`QuickMatchPostId`
        SET request.`Status` = 'Expired', request.`RespondedAt` = UTC_TIMESTAMP(6)
        WHERE request.`Status` = 'Pending' AND post.`EndsAtUtc` <= UTC_TIMESTAMP(6);

        SET @indexExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'QuickMatchPosts' AND INDEX_NAME = 'IX_QuickMatchPosts_IsActive_EndsAtUtc');
        SET @statement := IF(@indexExists = 0,
            'CREATE INDEX `IX_QuickMatchPosts_IsActive_EndsAtUtc` ON `QuickMatchPosts` (`IsActive`, `EndsAtUtc`)', 'SELECT 1');
        PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;
        """);
    #pragma warning disable EF1002 // Identifiers and DDL come only from this fixed local list.
    foreach (var column in new[]
    {
        (Name: "Latitude", Sql: "ALTER TABLE `Events` ADD COLUMN `Latitude` double NULL"),
        (Name: "Longitude", Sql: "ALTER TABLE `Events` ADD COLUMN `Longitude` double NULL"),
        (Name: "LocationCity", Sql: "ALTER TABLE `Events` ADD COLUMN `LocationCity` varchar(100) CHARACTER SET utf8mb4 NULL"),
        (Name: "LocationCountry", Sql: "ALTER TABLE `Events` ADD COLUMN `LocationCountry` varchar(100) CHARACTER SET utf8mb4 NULL"),
        (Name: "ShowFullAddress", Sql: "ALTER TABLE `Events` ADD COLUMN `ShowFullAddress` tinyint(1) NOT NULL DEFAULT 0"),
        (Name: "MinAge", Sql: "ALTER TABLE `Events` ADD COLUMN `MinAge` int NULL"),
        (Name: "MaxAge", Sql: "ALTER TABLE `Events` ADD COLUMN `MaxAge` int NULL"),
        (Name: "RequiresParticipantApproval", Sql: "ALTER TABLE `Events` ADD COLUMN `RequiresParticipantApproval` tinyint(1) NOT NULL DEFAULT 0")
    })
    {
        db.Database.ExecuteSqlRaw($"""
            SET @columnExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Events' AND COLUMN_NAME = '{column.Name}');
            SET @statement := IF(@columnExists = 0, '{column.Sql}', 'SELECT 1');
            PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;
            """);
    }
    #pragma warning restore EF1002
    db.Database.ExecuteSqlRaw("""
        SET @indexExists := (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Events' AND INDEX_NAME = 'IX_Events_MinAge_MaxAge');
        SET @statement := IF(@indexExists = 0,
            'CREATE INDEX `IX_Events_MinAge_MaxAge` ON `Events` (`MinAge`, `MaxAge`)', 'SELECT 1');
        PREPARE stmt FROM @statement; EXECUTE stmt; DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        UPDATE `Events`
        SET `LocationCity` = `Location`
        WHERE `LocationCity` IS NULL AND `ShowFullAddress` = 0;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `EventParticipants` (
            `EventId` int NOT NULL,
            `UserId` int NOT NULL,
            `JoinedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            CONSTRAINT `PK_EventParticipants` PRIMARY KEY (`EventId`, `UserId`),
            INDEX `IX_EventParticipants_UserId` (`UserId`)
        ) CHARACTER SET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `EventJoinRequests` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `EventId` int NOT NULL,
            `UserId` int NOT NULL,
            `Status` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'Pending',
            `CreatedAt` datetime(6) NOT NULL,
            `RespondedAt` datetime(6) NULL,
            CONSTRAINT `PK_EventJoinRequests` PRIMARY KEY (`Id`),
            CONSTRAINT `FK_EventJoinRequests_Events_EventId` FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_EventJoinRequests_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE,
            UNIQUE INDEX `IX_EventJoinRequests_EventId_UserId` (`EventId`, `UserId`),
            INDEX `IX_EventJoinRequests_EventId_Status` (`EventId`, `Status`),
            INDEX `IX_EventJoinRequests_UserId` (`UserId`)
        ) CHARACTER SET=utf8mb4;
        CREATE TABLE IF NOT EXISTS `SavedEvents` (
            `UserId` int NOT NULL,
            `EventId` int NOT NULL,
            `SavedAt` datetime(6) NOT NULL,
            CONSTRAINT `PK_SavedEvents` PRIMARY KEY (`UserId`, `EventId`),
            CONSTRAINT `FK_SavedEvents_Events_EventId` FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_SavedEvents_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE,
            INDEX `IX_SavedEvents_EventId` (`EventId`),
            INDEX `IX_SavedEvents_UserId_SavedAt` (`UserId`, `SavedAt`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
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
    db.Database.ExecuteSqlRaw("""
        SET @ratingEventNullable := (
            SELECT `IS_NULLABLE` FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings' AND COLUMN_NAME = 'EventId'
        );
        SET @ratingEventFkExists := (
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings'
              AND CONSTRAINT_NAME = 'FK_UserRatings_Events_EventId'
        );
        SET @statement := IF(
            @ratingEventNullable = 'NO' AND @ratingEventFkExists > 0,
            'ALTER TABLE `UserRatings` DROP FOREIGN KEY `FK_UserRatings_Events_EventId`',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;

        SET @statement := IF(
            @ratingEventNullable = 'NO',
            'ALTER TABLE `UserRatings` MODIFY COLUMN `EventId` int NULL',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;

        SET @ratingEventFkExists := (
            SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
            WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'UserRatings'
              AND CONSTRAINT_NAME = 'FK_UserRatings_Events_EventId'
        );
        SET @statement := IF(
            @ratingEventFkExists = 0,
            'ALTER TABLE `UserRatings` ADD CONSTRAINT `FK_UserRatings_Events_EventId` FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE',
            'SELECT 1'
        );
        PREPARE stmt FROM @statement;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `EventDiscussionMessages` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `EventId` int NOT NULL,
            `UserId` int NOT NULL,
            `Body` varchar(2000) CHARACTER SET utf8mb4 NOT NULL,
            `CreatedAt` datetime(6) NOT NULL,
            `UpdatedAt` datetime(6) NULL,
            `IsDeleted` tinyint(1) NOT NULL DEFAULT 0,
            CONSTRAINT `PK_EventDiscussionMessages` PRIMARY KEY (`Id`),
            CONSTRAINT `FK_EventDiscussionMessages_Events_EventId`
                FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_EventDiscussionMessages_Users_UserId`
                FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE,
            INDEX `IX_EventDiscussionMessages_EventId_CreatedAt` (`EventId`, `CreatedAt`),
            INDEX `IX_EventDiscussionMessages_UserId` (`UserId`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `MessageAttachments` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `ChatMessageId` int NULL,
            `EventDiscussionMessageId` int NULL,
            `Kind` varchar(20) CHARACTER SET utf8mb4 NOT NULL,
            `OriginalFileName` varchar(255) CHARACTER SET utf8mb4 NULL,
            `StoredFileName` varchar(80) CHARACTER SET utf8mb4 NULL,
            `ContentType` varchar(100) CHARACTER SET utf8mb4 NULL,
            `Size` bigint NOT NULL DEFAULT 0,
            `StoragePath` varchar(500) CHARACTER SET utf8mb4 NULL,
            `Provider` varchar(30) CHARACTER SET utf8mb4 NULL,
            `ProviderMediaId` varchar(100) CHARACTER SET utf8mb4 NULL,
            `OriginalUrl` varchar(1000) CHARACTER SET utf8mb4 NULL,
            `PreviewUrl` varchar(1000) CHARACTER SET utf8mb4 NULL,
            `CreatedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            CONSTRAINT `PK_MessageAttachments` PRIMARY KEY (`Id`),
            CONSTRAINT `CK_MessageAttachments_OneOwner` CHECK (
                (`ChatMessageId` IS NOT NULL AND `EventDiscussionMessageId` IS NULL)
                OR (`ChatMessageId` IS NULL AND `EventDiscussionMessageId` IS NOT NULL)
            ),
            CONSTRAINT `FK_MsgAttachments_ChatMessages`
                FOREIGN KEY (`ChatMessageId`) REFERENCES `ChatMessages` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_MsgAttachments_EventMessages`
                FOREIGN KEY (`EventDiscussionMessageId`) REFERENCES `EventDiscussionMessages` (`Id`) ON DELETE CASCADE,
            UNIQUE INDEX `IX_MessageAttachments_ChatMessageId` (`ChatMessageId`),
            UNIQUE INDEX `IX_MessageAttachments_EventDiscussionMessageId` (`EventDiscussionMessageId`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `EventInvites` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `EventId` int NOT NULL,
            `InviterUserId` int NOT NULL,
            `InviteeUserId` int NOT NULL,
            `Status` varchar(20) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'Pending',
            `CreatedAt` datetime(6) NOT NULL,
            `RespondedAt` datetime(6) NULL,
            CONSTRAINT `PK_EventInvites` PRIMARY KEY (`Id`),
            CONSTRAINT `FK_EventInvites_Events_EventId` FOREIGN KEY (`EventId`) REFERENCES `Events` (`Id`) ON DELETE CASCADE,
            CONSTRAINT `FK_EventInvites_Users_InviteeUserId` FOREIGN KEY (`InviteeUserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
            CONSTRAINT `FK_EventInvites_Users_InviterUserId` FOREIGN KEY (`InviterUserId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
            INDEX `IX_EventInvites_EventId_InviteeUserId_Status` (`EventId`, `InviteeUserId`, `Status`),
            INDEX `IX_EventInvites_InviteeUserId` (`InviteeUserId`),
            INDEX `IX_EventInvites_InviterUserId` (`InviterUserId`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `Notifications` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `UserId` int NOT NULL,
            `ActorUserId` int NULL,
            `Type` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
            `Title` varchar(140) CHARACTER SET utf8mb4 NOT NULL,
            `Message` varchar(500) CHARACTER SET utf8mb4 NOT NULL,
            `RelatedEntityType` varchar(50) CHARACTER SET utf8mb4 NULL,
            `RelatedEntityId` int NULL,
            `IsRead` tinyint(1) NOT NULL DEFAULT 0,
            `CreatedAt` datetime(6) NOT NULL,
            `ReadAt` datetime(6) NULL,
            CONSTRAINT `PK_Notifications` PRIMARY KEY (`Id`),
            CONSTRAINT `FK_Notifications_Users_ActorUserId` FOREIGN KEY (`ActorUserId`) REFERENCES `Users` (`Id`) ON DELETE SET NULL,
            CONSTRAINT `FK_Notifications_Users_UserId` FOREIGN KEY (`UserId`) REFERENCES `Users` (`Id`) ON DELETE CASCADE,
            INDEX `IX_Notifications_ActorUserId` (`ActorUserId`),
            INDEX `IX_Notifications_UserId_IsRead_CreatedAt` (`UserId`, `IsRead`, `CreatedAt`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        INSERT INTO `Interests` (`Name`, `Category`)
        SELECT 'Study', 'Event'
        WHERE NOT EXISTS (SELECT 1 FROM `Interests` WHERE `Name` = 'Study');

        INSERT INTO `Interests` (`Name`, `Category`)
        SELECT 'Gaming', 'Event'
        WHERE NOT EXISTS (SELECT 1 FROM `Interests` WHERE `Name` = 'Gaming');

        INSERT INTO `Interests` (`Name`, `Category`)
        SELECT 'Coffee', 'Event'
        WHERE NOT EXISTS (SELECT 1 FROM `Interests` WHERE `Name` = 'Coffee');

        INSERT INTO `Interests` (`Name`, `Category`)
        SELECT 'Social', 'Event'
        WHERE NOT EXISTS (SELECT 1 FROM `Interests` WHERE `Name` = 'Social');

        INSERT INTO `Interests` (`Name`, `Category`)
        SELECT 'Sport', 'Event'
        WHERE NOT EXISTS (SELECT 1 FROM `Interests` WHERE `Name` = 'Sport');
        """);
    db.Database.ExecuteSqlRaw("""
        SET @communityUserId := (SELECT `Id` FROM `Users` WHERE `IsActive` = 1 ORDER BY `Id` LIMIT 1);

        INSERT INTO `Events` (`Title`, `OrganizerId`, `InterestId`, `Date`, `Time`, `Location`, `MaxAttendees`, `Description`, `ImageUrl`)
        SELECT 'Grupno ucenje iz baza podataka', @communityUserId, (SELECT `Id` FROM `Interests` WHERE `Name` = 'Study' LIMIT 1), DATE_ADD(CURDATE(), INTERVAL 2 DAY), '18:00:00', 'Nis, Serbia', 8, 'Ucenje za ispit, normalizacija, SQL i ER dijagrami.', NULL
        WHERE @communityUserId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM `Events` WHERE `Title` = 'Grupno ucenje iz baza podataka');

        INSERT INTO `Events` (`Title`, `OrganizerId`, `InterestId`, `Date`, `Time`, `Location`, `MaxAttendees`, `Description`, `ImageUrl`)
        SELECT 'Vece igrica', @communityUserId, (SELECT `Id` FROM `Interests` WHERE `Name` = 'Gaming' LIMIT 1), DATE_ADD(CURDATE(), INTERVAL 3 DAY), '20:00:00', 'Nis, Serbia', 10, 'Casual gaming, board games ili online co-op.', NULL
        WHERE @communityUserId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM `Events` WHERE `Title` = 'Vece igrica');

        INSERT INTO `Events` (`Title`, `OrganizerId`, `InterestId`, `Date`, `Time`, `Location`, `MaxAttendees`, `Description`, `ImageUrl`)
        SELECT 'Coffee & coding session', @communityUserId, (SELECT `Id` FROM `Interests` WHERE `Name` = 'Coffee' LIMIT 1), DATE_ADD(CURDATE(), INTERVAL 4 DAY), '17:30:00', 'Nis, Serbia', 6, 'Rad na projektima, React/.NET i kratka kafa pauza.', NULL
        WHERE @communityUserId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM `Events` WHERE `Title` = 'Coffee & coding session');

        INSERT INTO `Events` (`Title`, `OrganizerId`, `InterestId`, `Date`, `Time`, `Location`, `MaxAttendees`, `Description`, `ImageUrl`)
        SELECT 'Setnja i prica', @communityUserId, (SELECT `Id` FROM `Interests` WHERE `Name` = 'Social' LIMIT 1), DATE_ADD(CURDATE(), INTERVAL 5 DAY), '19:00:00', 'Nis, Serbia', 12, 'Lagano upoznavanje i setnja.', NULL
        WHERE @communityUserId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM `Events` WHERE `Title` = 'Setnja i prica');

        INSERT INTO `Events` (`Title`, `OrganizerId`, `InterestId`, `Date`, `Time`, `Location`, `MaxAttendees`, `Description`, `ImageUrl`)
        SELECT 'Gym buddy trening', @communityUserId, (SELECT `Id` FROM `Interests` WHERE `Name` = 'Sport' LIMIT 1), DATE_ADD(CURDATE(), INTERVAL 6 DAY), '10:00:00', 'Nis, Serbia', 4, 'Lagani trening, beginner friendly.', NULL
        WHERE @communityUserId IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM `Events` WHERE `Title` = 'Gym buddy trening');

        UPDATE `Events`
        SET `Date` = CASE `Title`
            WHEN 'Grupno ucenje iz baza podataka' THEN DATE_ADD(CURDATE(), INTERVAL 2 DAY)
            WHEN 'Vece igrica' THEN DATE_ADD(CURDATE(), INTERVAL 3 DAY)
            WHEN 'Coffee & coding session' THEN DATE_ADD(CURDATE(), INTERVAL 4 DAY)
            WHEN 'Setnja i prica' THEN DATE_ADD(CURDATE(), INTERVAL 5 DAY)
            WHEN 'Gym buddy trening' THEN DATE_ADD(CURDATE(), INTERVAL 6 DAY)
        END
        WHERE `Title` IN (
            'Grupno ucenje iz baza podataka',
            'Vece igrica',
            'Coffee & coding session',
            'Setnja i prica',
            'Gym buddy trening'
        )
          AND TIMESTAMP(`Date`, `Time`) < NOW();

        INSERT IGNORE INTO `EventParticipants` (`EventId`, `UserId`, `JoinedAt`)
        SELECT `Id`, @communityUserId, UTC_TIMESTAMP(6)
        FROM `Events`
        WHERE @communityUserId IS NOT NULL
          AND `Title` IN (
              'Grupno ucenje iz baza podataka',
              'Vece igrica',
              'Coffee & coding session',
              'Setnja i prica',
              'Gym buddy trening'
          );
        """);

    if (schemaOnly)
    {
        var chatService = scope.ServiceProvider.GetRequiredService<IChatService>();
        var privateChat = await db.ChatConversations.AsNoTracking()
            .Where(conversation => !conversation.IsGroup && conversation.UserAId != null)
            .OrderBy(conversation => conversation.Id)
            .Select(conversation => new { conversation.Id, UserId = conversation.UserAId!.Value })
            .FirstOrDefaultAsync();
        if (privateChat != null)
        {
            var messages = await chatService.GetMessagesAsync(privateChat.UserId, privateChat.Id);
            Console.WriteLine($"Private chat history query completed successfully ({messages.Count} messages).");
        }

        var groupChat = await db.ChatConversationMembers.AsNoTracking()
            .Where(member => member.LeftAt == null)
            .OrderBy(member => member.ConversationId)
            .Select(member => new { member.ConversationId, member.UserId })
            .FirstOrDefaultAsync();
        if (groupChat != null)
        {
            var messages = await chatService.GetMessagesAsync(groupChat.UserId, groupChat.ConversationId);
            Console.WriteLine($"Group chat history query completed successfully ({messages.Count} messages).");
        }

        var eventParticipant = await db.EventParticipants.AsNoTracking()
            .OrderBy(participant => participant.EventId)
            .Select(participant => new { participant.EventId, participant.UserId })
            .FirstOrDefaultAsync();
        if (eventParticipant != null)
        {
            var eventService = scope.ServiceProvider.GetRequiredService<IEventService>();
            var messages = await eventService.GetDiscussionAsync(eventParticipant.EventId, eventParticipant.UserId);
            Console.WriteLine($"Event discussion history query completed successfully ({messages.Count} messages).");
        }

        var verificationUserIds = await db.Users.AsNoTracking().Where(user => user.IsActive)
            .OrderBy(user => user.Id).Select(user => user.Id).Take(2).ToListAsync();
        if (verificationUserIds.Count == 2)
        {
            var ratingService = scope.ServiceProvider.GetRequiredService<IUserRatingService>();
            await ratingService.GetStatusAsync(verificationUserIds[0], verificationUserIds[1]);
            Console.WriteLine("Rating status query completed successfully.");
        }
    }
}

if (schemaOnly)
{
    Console.WriteLine("Development schema update completed.");
    return;
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("AllowAll");
app.UseMiddleware<ApiExceptionMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
try
{
    app.Run();
}
catch (IOException exception) when (IsAddressAlreadyInUse(exception))
{
    Console.Error.WriteLine(
        "MatchYourMatch WebAPI is already running on port 5166. " +
        "Use the existing instance or stop it before starting another one.");
}

static bool IsAddressAlreadyInUse(Exception exception)
{
    for (var current = exception; current != null; current = current.InnerException)
    {
        if (current is AddressInUseException)
            return true;
    }

    return false;
}
