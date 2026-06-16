using System.Security.Claims;
using MatchYourMatch.WebAPI.DTOs.Chat;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace MatchYourMatch.WebAPI.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;

        public ChatController(IChatService chatService)
        {
            _chatService = chatService;
        }

        [HttpGet("conversations")]
        public async Task<ActionResult<List<ChatConversationDto>>> GetConversations()
        {
            return Ok(await _chatService.GetConversationsAsync(GetCurrentUserId()));
        }

        [HttpGet("conversations/{conversationId:int}/messages")]
        public async Task<ActionResult<List<ChatMessageDto>>> GetMessages(int conversationId)
        {
            try
            {
                return Ok(await _chatService.GetMessagesAsync(GetCurrentUserId(), conversationId));
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
        }

        [Authorize(Roles = "User")]
        [HttpPost("conversations/start")]
        public async Task<ActionResult<ChatConversationDto>> StartConversation(StartChatConversationDto request)
        {
            try
            {
                return Ok(await _chatService.StartConversationAsync(GetCurrentUserId(), request.OtherUserId));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [Authorize(Roles = "User")]
        [HttpPost("messages")]
        public async Task<ActionResult<ChatMessageDto>> SendMessage(SendChatMessageDto request)
        {
            try
            {
                return Ok(await _chatService.SendMessageAsync(GetCurrentUserId(), request));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpPut("conversations/{conversationId:int}/read")]
        public async Task<IActionResult> MarkRead(int conversationId)
        {
            try
            {
                await _chatService.MarkConversationReadAsync(GetCurrentUserId(), conversationId);
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
        }

        [HttpDelete("conversations/{conversationId:int}")]
        public async Task<IActionResult> HideConversation(int conversationId)
        {
            try
            {
                await _chatService.HideConversationAsync(GetCurrentUserId(), conversationId);
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
        }

        [HttpDelete("messages/{messageId:int}")]
        public async Task<IActionResult> DeleteMessage(int messageId)
        {
            try
            {
                await _chatService.DeleteMessageForUserAsync(GetCurrentUserId(), messageId);
                return NoContent();
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
        }

        [Authorize(Roles = "User")]
        [HttpPatch("messages/{messageId:int}")]
        public async Task<ActionResult<ChatMessageDto>> UpdateMessage(int messageId, UpdateChatMessageDto request)
        {
            try
            {
                return Ok(await _chatService.UpdateMessageAsync(GetCurrentUserId(), messageId, request));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
            catch (InvalidOperationException ex)
            {
                return BadRequest(ex.Message);
            }
        }

        [HttpDelete("messages/{messageId:int}/for-me")]
        public async Task<IActionResult> DeleteMessageForMe(int messageId)
        {
            return await DeleteMessage(messageId);
        }

        [Authorize(Roles = "User")]
        [HttpDelete("messages/{messageId:int}/for-everyone")]
        public async Task<ActionResult<ChatMessageDto>> DeleteMessageForEveryone(int messageId)
        {
            try
            {
                return Ok(await _chatService.DeleteMessageForEveryoneAsync(GetCurrentUserId(), messageId));
            }
            catch (KeyNotFoundException ex)
            {
                return NotFound(ex.Message);
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
        }

        [HttpPost("typing")]
        public async Task<IActionResult> SetTyping(ChatTypingDto request)
        {
            try
            {
                await _chatService.SetTypingAsync(GetCurrentUserId(), request.ConversationId, request.IsTyping);
                return NoContent();
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
        }

        [HttpGet("conversations/{conversationId:int}/typing")]
        public async Task<ActionResult<object>> IsTyping(int conversationId)
        {
            try
            {
                var isTyping = await _chatService.IsOtherUserTypingAsync(GetCurrentUserId(), conversationId);
                return Ok(new { isTyping });
            }
            catch (UnauthorizedAccessException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, ex.Message);
            }
        }

        private int GetCurrentUserId()
        {
            return int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)!.Value);
        }
    }
}
