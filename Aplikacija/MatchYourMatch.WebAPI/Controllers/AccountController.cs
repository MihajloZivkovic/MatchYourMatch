using System.Security.Claims;
using MatchYourMatch.WebAPI.DTOs.Account;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers;

[ApiController]
[Route("api/account")]
public class AccountController : ControllerBase
{
    private readonly IAccountService _accounts;
    public AccountController(IAccountService accounts, ILogger<AccountController> logger) 
    { 
        _accounts = accounts;
    }

    [Authorize]
    [HttpGet("status")]
    public async Task<IActionResult> Status() => Ok(await _accounts.GetStatusAsync(CurrentUserId()));

    [Authorize]
    [HttpPatch("username")]
    public async Task<IActionResult> UpdateUsername(UpdateUsernameDto dto) => await Handle(async () =>
        Ok(await _accounts.UpdateUsernameAsync(CurrentUserId(), dto)));

    [Authorize]
    [HttpPatch("email")]
    public async Task<IActionResult> UpdateEmail(UpdateEmailDto dto) => await Handle(async () =>
        Ok(await _accounts.UpdateEmailAsync(CurrentUserId(), dto)));

    [Authorize]
    [HttpPatch("password")]
    public async Task<IActionResult> UpdatePassword(UpdatePasswordDto dto) => await Handle(async () =>
    {
        await _accounts.ChangePasswordAsync(CurrentUserId(), dto);
        return Ok(new { success = true, message = "Password updated." });
    });

    [Authorize]
    [HttpPatch("profile-visibility")]
    public async Task<IActionResult> UpdateProfileVisibility(UpdateProfileVisibilityDto dto) 
        => await Handle(async () => Ok(await _accounts.UpdateProfileVisibilityAsync(CurrentUserId(), dto)));

    [Authorize]
    [HttpPost("deactivate")]
    public async Task<IActionResult> Deactivate(DeactivateAccountDto dto) => await Handle(async () =>
    {
        await _accounts.DeactivateAsync(CurrentUserId(), dto);
        return Ok(new { success = true, message = "Account deactivated." });
    });

    [AllowAnonymous]
    [HttpPost("reactivate")]
    public async Task<IActionResult> Reactivate(ReactivateAccountDto dto) 
        => await Handle(async () => Ok(await _accounts.ReactivateAsync(dto)));

    [Authorize]
    [HttpDelete]
    public async Task<IActionResult> Delete(DeleteAccountDto dto) => await Handle(async () =>
    {
        await _accounts.DeleteAsync(CurrentUserId(), dto);
        return Ok(new { success = true, message = "Account permanently deleted." });
    });

    private int CurrentUserId() 
        => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private async Task<IActionResult> Handle(Func<Task<IActionResult>> action)
    {
        try { 
            return await action(); 
        }
        catch (UnauthorizedAccessException ex) 
        { 
            return Unauthorized(new { message = ex.Message }); 
        }
        catch (KeyNotFoundException ex) 
        { 
            return NotFound(new { message = ex.Message }); 
        }
        catch (InvalidOperationException ex) 
        { 
            return BadRequest(new { message = ex.Message }); 
        }
        catch (Exception ex) 
        { 
            return StatusCode(500, new { message = ex.Message }); 
        }
    }
}
