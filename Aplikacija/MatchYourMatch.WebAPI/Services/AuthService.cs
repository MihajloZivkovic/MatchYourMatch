using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Auth;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace MatchYourMatch.WebAPI.Services
{
    public class AuthService : IAuthService
    {
        private readonly IConfiguration _config;
        private readonly AppDbContext _context;

        private readonly string _issuer;
        private readonly string _audience;
        private readonly string _secret;

        public AuthService(IConfiguration config, AppDbContext context)
        {
            _config = config;
            _context = context;

            _issuer = _config["JwtSettings:Issuer"]!;
            _audience = _config["JwtSettings:Audience"]!;
            _secret = _config["JwtSettings:Secret"]!;
        }

        public async Task<AuthInfoDto> RegisterAsync(RegisterDto dto)
        {
            if (await _context.Users.AnyAsync(u => u.Email == dto.Email))
                throw new Exception("Email u upotrebi.");

            var user = new User
            {
                Username = dto.Username,
                Email = dto.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password)
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();
            return GenerateResponse(user);
        }

        public async Task<AuthInfoDto> LoginAsync(LoginDto dto)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == dto.Email);

            if (user == null)
                throw new Exception("Pogresan email.");

            if (!BCrypt.Net.BCrypt.Verify(dto.Password, user.PasswordHash))
                throw new Exception("Pogresna lozinka.");

            return GenerateResponse(user);
        }

        private AuthInfoDto GenerateResponse(User user)
        {
            var expiry = DateTime.Now.AddMinutes(int.Parse(_config["JwtSettings:ExpiresInMinutes"]!));

            return new AuthInfoDto
            {
                AccessToken = GenerateToken(user, expiry),
                AccessTokenExpiry = expiry,
                UserInfo = new UserInfoDto
                {
                    Username = user.Username,
                    Email = user.Email,
                    Role = user.Role
                }
            };
        }

        private string GenerateToken(User user, DateTime expiry)
        {
            var _claims = new[]
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role)
            };

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _issuer,
                audience: _audience,
                claims: _claims,
                expires: expiry,
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
