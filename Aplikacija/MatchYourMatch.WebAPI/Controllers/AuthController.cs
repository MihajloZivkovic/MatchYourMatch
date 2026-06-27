using System.Security.Claims;
using MatchYourMatch.WebAPI.DTOs.Auth;
using MatchYourMatch.WebAPI.Services;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController: ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterDto dto)
        {
            try
            {
                var response = await _authService.RegisterAsync(dto);
                return Ok(response);
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginDto dto)
        {
            try
            {
                var response = await _authService.LoginAsync(dto);
                return Ok(response);
            }
            catch (AccountDeactivatedException ex)
            {
                return Conflict(new { requiresReactivation = true, message = ex.Message });
            }
            catch (Exception ex)
            {
                return ex.Message == "Please verify your email before logging in."
                    ? StatusCode(StatusCodes.Status403Forbidden, ex.Message)
                    : Unauthorized(ex.Message);
            }
        }

        [HttpPost("guest")]
        public IActionResult Guest(GuestLoginDto dto)
        {
            try
            {
                return Ok(_authService.CreateGuestSession(dto));
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("verify-email")]
        public async Task<IActionResult> VerifyEmail(VerifyEmailDto dto)
        {
            try
            {
                await _authService.VerifyEmailAsync(dto);
                return Ok(new { message = "Email verified. You can now log in." });
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("resend-verification")]
        public async Task<IActionResult> ResendVerification(ResendVerificationDto dto)
        {
            try
            {
                await _authService.ResendVerificationAsync(dto);
                return Ok(new { message = "If the account exists and is unverified, a new code has been sent." });
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("external-login/google")]
        public async Task<IActionResult> GoogleLogin(ExternalLoginDto dto)
        {
            try { return Ok(await _authService.GoogleLoginAsync(dto)); }
            catch (AccountDeactivatedException ex) { return Conflict(new { requiresReactivation = true, message = ex.Message }); }
            catch (InvalidOperationException ex) { return StatusCode(StatusCodes.Status501NotImplemented, ex.Message); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("external-login/facebook")]
        public IActionResult FacebookLogin()
        {
            return StatusCode(StatusCodes.Status501NotImplemented, "Facebook login is not supported.");
        }

        [HttpPost("external-login/microsoft")]
        public async Task<IActionResult> MicrosoftLogin(ExternalLoginDto dto)
        {
            try { return Ok(await _authService.MicrosoftLoginAsync(dto)); }
            catch (AccountDeactivatedException ex) { return Conflict(new { requiresReactivation = true, message = ex.Message }); }
            catch (InvalidOperationException ex) { return StatusCode(StatusCodes.Status501NotImplemented, ex.Message); }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [Authorize]
        [HttpPut("complete-social-profile")]
        public async Task<IActionResult> CompleteSocialProfile(CompleteSocialProfileDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                return Ok(await _authService.CompleteSocialProfileAsync(userId, dto));
            }
            catch (Exception ex) { return BadRequest(ex.Message); }
        }

        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordDto dto)
        {
            try
            {
                await _authService.ForgotPasswordAsync(dto);
                return Ok("Email sa tokenom je poslat.");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPost("reset-password")]
        public async Task<IActionResult> ResetPassword(ResetPasswordDto dto)
        {
            try
            {
                await _authService.ResetPasswordAsync(dto);
                return Ok("Lozinka uspesno promenjena.");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize]
        [HttpPut("change-email")]
        public async Task<IActionResult> ChangeEmail(ChangeEmailDto dto)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
                await _authService.ChangeEmailAsync(userId, dto);
                return Ok("Email uspesno promenjen.");
            }
            catch (Exception ex)
            {
                return BadRequest(ex.Message);
            }
        }
    }
}
