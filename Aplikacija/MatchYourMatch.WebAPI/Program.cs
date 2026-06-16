using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.Services;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using System.Text;

DotNetEnv.Env.Load();
var builder = WebApplication.CreateBuilder(args);

builder.Logging.ClearProviders();
builder.Logging.AddConsole();

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
    });

builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IUserProfilesService, UserProfilesService>();
builder.Services.AddScoped<IEventService, EventService>();
builder.Services.AddScoped<IQuickMatchService, QuickMatchService>();
builder.Services.AddScoped<IDeepMatchService, DeepMatchService>();
builder.Services.AddScoped<IChatService, ChatService>();
builder.Services.AddHttpClient<IGeocodingService, GeocodingService>();
builder.Services.AddScoped<IFollowService, FollowService>();
builder.Services.AddScoped<IAdminService, AdminService>();
builder.Services.AddScoped<EmailService>();

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
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `ChatConversations` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `UserAId` int NOT NULL,
            `UserBId` int NOT NULL,
            `CreatedAt` datetime(6) NOT NULL,
            `LastMessageAt` datetime(6) NULL,
            `IsHiddenForUserA` tinyint(1) NOT NULL DEFAULT 0,
            `IsHiddenForUserB` tinyint(1) NOT NULL DEFAULT 0,
            CONSTRAINT `PK_ChatConversations` PRIMARY KEY (`Id`),
            UNIQUE INDEX `IX_ChatConversations_UserAId_UserBId` (`UserAId`, `UserBId`),
            INDEX `IX_ChatConversations_UserBId` (`UserBId`),
            CONSTRAINT `FK_ChatConversations_Users_UserAId` FOREIGN KEY (`UserAId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT,
            CONSTRAINT `FK_ChatConversations_Users_UserBId` FOREIGN KEY (`UserBId`) REFERENCES `Users` (`Id`) ON DELETE RESTRICT
        ) CHARACTER SET=utf8mb4;
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
        CREATE TABLE IF NOT EXISTS `ChatMessages` (
            `Id` int NOT NULL AUTO_INCREMENT,
            `ConversationId` int NOT NULL,
            `SenderId` int NOT NULL,
            `ReceiverId` int NOT NULL,
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
            `Description` longtext CHARACTER SET utf8mb4 NULL,
            `ImageUrl` longtext CHARACTER SET utf8mb4 NULL,
            CONSTRAINT `PK_Events` PRIMARY KEY (`Id`),
            INDEX `IX_Events_InterestId` (`InterestId`),
            INDEX `IX_Events_OrganizerId` (`OrganizerId`)
        ) CHARACTER SET=utf8mb4;
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS `EventParticipants` (
            `EventId` int NOT NULL,
            `UserId` int NOT NULL,
            `JoinedAt` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
            CONSTRAINT `PK_EventParticipants` PRIMARY KEY (`EventId`, `UserId`),
            INDEX `IX_EventParticipants_UserId` (`UserId`)
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
}

app.UseSwagger();
app.UseSwaggerUI();
app.UseHttpsRedirection();
app.UseCors("AllowAll");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
