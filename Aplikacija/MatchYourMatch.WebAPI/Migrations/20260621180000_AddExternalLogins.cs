using MatchYourMatch.WebAPI.Data;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Metadata;
#nullable disable
namespace MatchYourMatch.WebAPI.Migrations
{
    [DbContext(typeof(AppDbContext))][Migration("20260621180000_AddExternalLogins")]
    public partial class AddExternalLogins : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable("ExternalLogins", table => new { Id=table.Column<int>("int",nullable:false).Annotation("MySql:ValueGenerationStrategy",MySqlValueGenerationStrategy.IdentityColumn), UserId=table.Column<int>("int",nullable:false), Provider=table.Column<string>("varchar(30)",maxLength:30,nullable:false), ProviderUserId=table.Column<string>("varchar(200)",maxLength:200,nullable:false), ProviderEmail=table.Column<string>("longtext",nullable:true), CreatedAt=table.Column<DateTime>("datetime(6)",nullable:false) }, constraints:table=>{table.PrimaryKey("PK_ExternalLogins",x=>x.Id);table.ForeignKey("FK_ExternalLogins_Users_UserId",x=>x.UserId,"Users","Id",onDelete:ReferentialAction.Cascade);}).Annotation("MySql:CharSet","utf8mb4");
            migrationBuilder.CreateIndex("IX_ExternalLogins_Provider_ProviderUserId","ExternalLogins",new[]{"Provider","ProviderUserId"},unique:true);
            migrationBuilder.CreateIndex("IX_ExternalLogins_UserId","ExternalLogins","UserId");
        }
        protected override void Down(MigrationBuilder migrationBuilder)=>migrationBuilder.DropTable("ExternalLogins");
    }
}
