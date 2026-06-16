using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Chat;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class ChatService : IChatService
    {
        private const int MaxMessageLength = 2000;
        private static readonly TimeSpan TypingTtl = TimeSpan.FromSeconds(4);
        private static readonly Dictionary<(int ConversationId, int UserId), DateTime> TypingUntil = new();
        private static readonly object TypingLock = new();
        private readonly AppDbContext _context;

        public ChatService(AppDbContext context)
        {
            _context = context;
        }

        public async Task<List<ChatConversationDto>> GetConversationsAsync(int userId)
        {
            var conversations = await _context.ChatConversations
                .AsNoTracking()
                .Include(c => c.UserA)
                    .ThenInclude(u => u!.Profile)
                .Include(c => c.UserB)
                    .ThenInclude(u => u!.Profile)
                .Include(c => c.Messages)
                .Where(c =>
                    (c.UserAId == userId && !c.IsHiddenForUserA) ||
                    (c.UserBId == userId && !c.IsHiddenForUserB))
                .OrderByDescending(c => c.LastMessageAt ?? c.CreatedAt)
                .ToListAsync();

            return conversations.Select(c => MapConversation(c, userId)).ToList();
        }

        public async Task<List<ChatMessageDto>> GetMessagesAsync(int userId, int conversationId)
        {
            var conversation = await GetConversationForUser(conversationId, userId);

            var messages = await _context.ChatMessages
                .AsNoTracking()
                .Where(m =>
                    m.ConversationId == conversation.Id &&
                    ((m.SenderId == userId && !m.IsDeletedForSender) ||
                     (m.ReceiverId == userId && !m.IsDeletedForReceiver)))
                .OrderBy(m => m.CreatedAt)
                .ThenBy(m => m.Id)
                .ToListAsync();

            return messages.Select(message => MapMessage(message, userId)).ToList();
        }

        public async Task<ChatConversationDto> StartConversationAsync(int userId, int otherUserId)
        {
            await EnsureCanUseUserChat(userId);

            if (userId == otherUserId)
                throw new InvalidOperationException("You cannot start a chat with yourself.");

            var otherUser = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == otherUserId && u.IsActive);

            if (otherUser == null)
                throw new KeyNotFoundException("User does not exist.");

            if (!IsOrdinaryUser(otherUser))
                throw new UnauthorizedAccessException("You can only message ordinary users.");

            var firstId = Math.Min(userId, otherUserId);
            var secondId = Math.Max(userId, otherUserId);

            var conversation = await _context.ChatConversations
                .Include(c => c.UserA)
                    .ThenInclude(u => u!.Profile)
                .Include(c => c.UserB)
                    .ThenInclude(u => u!.Profile)
                .Include(c => c.Messages)
                .FirstOrDefaultAsync(c => c.UserAId == firstId && c.UserBId == secondId);

            if (conversation == null)
            {
                conversation = new ChatConversation
                {
                    UserAId = firstId,
                    UserBId = secondId,
                    CreatedAt = DateTime.UtcNow
                };

                _context.ChatConversations.Add(conversation);
                await _context.SaveChangesAsync();

                conversation = await _context.ChatConversations
                    .Include(c => c.UserA)
                        .ThenInclude(u => u!.Profile)
                    .Include(c => c.UserB)
                        .ThenInclude(u => u!.Profile)
                    .Include(c => c.Messages)
                    .FirstAsync(c => c.Id == conversation.Id);
            }
            else
            {
                SetHiddenForUser(conversation, userId, false);
                await _context.SaveChangesAsync();
            }

            return MapConversation(conversation, userId);
        }

        public async Task<ChatMessageDto> SendMessageAsync(int userId, SendChatMessageDto request)
        {
            await EnsureCanUseUserChat(userId);

            var body = request.Body?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(body))
                throw new InvalidOperationException("Message cannot be empty.");

            if (body.Length > MaxMessageLength)
                throw new InvalidOperationException($"Message cannot be longer than {MaxMessageLength} characters.");

            var conversation = await GetConversationForUser(request.ConversationId, userId);
            var receiverId = conversation.UserAId == userId ? conversation.UserBId : conversation.UserAId;

            var receiver = await _context.Users.FirstOrDefaultAsync(u => u.Id == receiverId && u.IsActive);
            if (receiver == null)
                throw new KeyNotFoundException("Receiver does not exist.");

            if (!IsOrdinaryUser(receiver))
                throw new UnauthorizedAccessException("You can only message ordinary users.");

            var message = new ChatMessage
            {
                ConversationId = conversation.Id,
                SenderId = userId,
                ReceiverId = receiverId,
                Body = body,
                CreatedAt = DateTime.UtcNow
            };

            conversation.LastMessageAt = message.CreatedAt;
            SetHiddenForUser(conversation, userId, false);
            SetHiddenForUser(conversation, receiverId, false);
            _context.ChatMessages.Add(message);
            await _context.SaveChangesAsync();

            return MapMessage(message, userId);
        }

        public async Task<ChatMessageDto> UpdateMessageAsync(int userId, int messageId, UpdateChatMessageDto request)
        {
            await EnsureCanUseUserChat(userId);

            var body = request.Body?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(body))
                throw new InvalidOperationException("Message cannot be empty.");

            if (body.Length > MaxMessageLength)
                throw new InvalidOperationException($"Message cannot be longer than {MaxMessageLength} characters.");

            var message = await _context.ChatMessages.FirstOrDefaultAsync(m => m.Id == messageId);
            if (message == null)
                throw new KeyNotFoundException("Message does not exist.");

            if (message.SenderId != userId)
                throw new UnauthorizedAccessException("You can only edit your own messages.");

            if (message.IsDeletedForEveryone)
                throw new InvalidOperationException("Deleted messages cannot be edited.");

            message.Body = body;
            message.EditedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapMessage(message, userId);
        }

        public async Task HideConversationAsync(int userId, int conversationId)
        {
            var conversation = await GetConversationForUser(conversationId, userId);
            SetHiddenForUser(conversation, userId, true);
            await _context.SaveChangesAsync();
        }

        public async Task<ChatMessageDto> DeleteMessageForEveryoneAsync(int userId, int messageId)
        {
            await EnsureCanUseUserChat(userId);

            var message = await _context.ChatMessages.FirstOrDefaultAsync(m => m.Id == messageId);
            if (message == null)
                throw new KeyNotFoundException("Message does not exist.");

            if (message.SenderId != userId)
                throw new UnauthorizedAccessException("You can only delete your own messages for everyone.");

            message.IsDeletedForEveryone = true;
            message.DeletedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return MapMessage(message, userId);
        }

        public async Task MarkConversationReadAsync(int userId, int conversationId)
        {
            var conversation = await GetConversationForUser(conversationId, userId);
            var now = DateTime.UtcNow;

            var unreadMessages = await _context.ChatMessages
                .Where(m =>
                    m.ConversationId == conversation.Id &&
                    m.ReceiverId == userId &&
                    m.ReadAt == null &&
                    !m.IsDeletedForReceiver)
                .ToListAsync();

            foreach (var message in unreadMessages)
            {
                message.ReadAt = now;
            }

            await _context.SaveChangesAsync();
        }

        public async Task DeleteMessageForUserAsync(int userId, int messageId)
        {
            var message = await _context.ChatMessages
                .Include(m => m.Conversation)
                .FirstOrDefaultAsync(m => m.Id == messageId);

            if (message == null)
                throw new KeyNotFoundException("Message does not exist.");

            if (message.SenderId != userId && message.ReceiverId != userId)
                throw new UnauthorizedAccessException("You cannot delete this message.");

            if (message.SenderId == userId)
            {
                message.IsDeletedForSender = true;
            }
            else
            {
                message.IsDeletedForReceiver = true;
            }

            await _context.SaveChangesAsync();
        }

        public async Task SetTypingAsync(int userId, int conversationId, bool isTyping)
        {
            await GetConversationForUser(conversationId, userId);

            lock (TypingLock)
            {
                var key = (conversationId, userId);
                if (isTyping)
                {
                    TypingUntil[key] = DateTime.UtcNow.Add(TypingTtl);
                }
                else
                {
                    TypingUntil.Remove(key);
                }

                RemoveExpiredTypingEntries();
            }
        }

        public async Task<bool> IsOtherUserTypingAsync(int userId, int conversationId)
        {
            await GetConversationForUser(conversationId, userId);

            lock (TypingLock)
            {
                RemoveExpiredTypingEntries();

                return TypingUntil.Any(entry =>
                    entry.Key.ConversationId == conversationId &&
                    entry.Key.UserId != userId &&
                    entry.Value > DateTime.UtcNow);
            }
        }

        private async Task EnsureCanUseUserChat(int userId)
        {
            var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId && u.IsActive);

            if (user == null)
                throw new KeyNotFoundException("User does not exist.");

            if (!IsOrdinaryUser(user))
                throw new UnauthorizedAccessException("Only ordinary users can send messages.");
        }

        private async Task<ChatConversation> GetConversationForUser(int conversationId, int userId)
        {
            var conversation = await _context.ChatConversations
                .FirstOrDefaultAsync(c =>
                    c.Id == conversationId &&
                    (c.UserAId == userId || c.UserBId == userId));

            if (conversation == null)
                throw new UnauthorizedAccessException("Conversation is not available.");

            return conversation;
        }

        private static bool IsOrdinaryUser(User user)
        {
            return string.Equals(user.Role, "User", StringComparison.OrdinalIgnoreCase);
        }

        private static void SetHiddenForUser(ChatConversation conversation, int userId, bool isHidden)
        {
            if (conversation.UserAId == userId)
            {
                conversation.IsHiddenForUserA = isHidden;
                return;
            }

            if (conversation.UserBId == userId)
            {
                conversation.IsHiddenForUserB = isHidden;
            }
        }

        private static ChatConversationDto MapConversation(ChatConversation conversation, int currentUserId)
        {
            var otherUser = conversation.UserAId == currentUserId ? conversation.UserB! : conversation.UserA!;
            var lastVisibleMessage = conversation.Messages
                .Where(m =>
                    !m.IsDeletedForEveryone &&
                    ((m.SenderId == currentUserId && !m.IsDeletedForSender) ||
                     (m.ReceiverId == currentUserId && !m.IsDeletedForReceiver)))
                .OrderByDescending(m => m.CreatedAt)
                .ThenByDescending(m => m.Id)
                .FirstOrDefault();

            return new ChatConversationDto
            {
                ConversationId = conversation.Id,
                OtherUserId = otherUser.Id,
                OtherUsername = otherUser.Username,
                OtherDisplayName = otherUser.Username,
                OtherInitials = GetInitials(otherUser.Username),
                OtherAvatar = otherUser.Profile?.ProfilePicture,
                LastMessagePreview = lastVisibleMessage?.Body,
                LastMessageAt = conversation.LastMessageAt ?? lastVisibleMessage?.CreatedAt ?? conversation.CreatedAt,
                UnreadCount = conversation.Messages.Count(m =>
                    !m.IsDeletedForEveryone &&
                    m.ReceiverId == currentUserId &&
                    m.ReadAt == null &&
                    !m.IsDeletedForReceiver)
            };
        }

        private static ChatMessageDto MapMessage(ChatMessage message, int currentUserId)
        {
            return new ChatMessageDto
            {
                Id = message.Id,
                ConversationId = message.ConversationId,
                SenderId = message.SenderId,
                ReceiverId = message.ReceiverId,
                Body = message.Body,
                CreatedAt = message.CreatedAt,
                ReadAt = message.ReadAt,
                EditedAt = message.EditedAt,
                IsDeletedForEveryone = message.IsDeletedForEveryone,
                DeletedAt = message.DeletedAt,
                IsMine = message.SenderId == currentUserId
            };
        }

        private static string GetInitials(string username)
        {
            var parts = username
                .Split(new[] { '.', '_', '-', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Take(2)
                .Select(part => char.ToUpperInvariant(part[0]).ToString())
                .ToList();

            return parts.Count == 0 ? "MY" : string.Join("", parts);
        }

        private static void RemoveExpiredTypingEntries()
        {
            var now = DateTime.UtcNow;
            foreach (var key in TypingUntil.Where(entry => entry.Value <= now).Select(entry => entry.Key).ToList())
            {
                TypingUntil.Remove(key);
            }
        }
    }
}
