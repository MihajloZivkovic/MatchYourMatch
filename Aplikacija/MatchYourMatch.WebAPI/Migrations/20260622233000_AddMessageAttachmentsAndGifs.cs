using System;
using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace MatchYourMatch.WebAPI.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260622233000_AddMessageAttachmentsAndGifs")]
public partial class AddMessageAttachmentsAndGifs : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "MessageAttachments",
            columns: table => new
            {
                Id = table.Column<int>(type: "int", nullable: false).Annotation("MySql:ValueGenerationStrategy", MySqlValueGenerationStrategy.IdentityColumn),
                ChatMessageId = table.Column<int>(type: "int", nullable: true),
                EventDiscussionMessageId = table.Column<int>(type: "int", nullable: true),
                Kind = table.Column<string>(type: "varchar(20)", maxLength: 20, nullable: false),
                OriginalFileName = table.Column<string>(type: "varchar(255)", maxLength: 255, nullable: true),
                StoredFileName = table.Column<string>(type: "varchar(80)", maxLength: 80, nullable: true),
                ContentType = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                Size = table.Column<long>(type: "bigint", nullable: false),
                StoragePath = table.Column<string>(type: "varchar(500)", maxLength: 500, nullable: true),
                Provider = table.Column<string>(type: "varchar(30)", maxLength: 30, nullable: true),
                ProviderMediaId = table.Column<string>(type: "varchar(100)", maxLength: 100, nullable: true),
                OriginalUrl = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                PreviewUrl = table.Column<string>(type: "varchar(1000)", maxLength: 1000, nullable: true),
                CreatedAt = table.Column<DateTime>(type: "datetime(6)", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_MessageAttachments", x => x.Id);
                table.CheckConstraint("CK_MessageAttachments_OneOwner", "(`ChatMessageId` IS NOT NULL AND `EventDiscussionMessageId` IS NULL) OR (`ChatMessageId` IS NULL AND `EventDiscussionMessageId` IS NOT NULL)");
                table.ForeignKey("FK_MsgAttachments_ChatMessages", x => x.ChatMessageId, "ChatMessages", "Id", onDelete: ReferentialAction.Cascade);
                table.ForeignKey("FK_MsgAttachments_EventMessages", x => x.EventDiscussionMessageId, "EventDiscussionMessages", "Id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex("IX_MessageAttachments_ChatMessageId", "MessageAttachments", "ChatMessageId", unique: true);
        migrationBuilder.CreateIndex("IX_MessageAttachments_EventDiscussionMessageId", "MessageAttachments", "EventDiscussionMessageId", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "MessageAttachments");
}
