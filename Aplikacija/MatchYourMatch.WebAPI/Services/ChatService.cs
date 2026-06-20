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
        private const int MaxReactionEmojiLength = 16;
        private const int MaxGroupNameLength = 120;
        private const int MaxGroupPhotoLength = 3_000_000;
        private const int MinOtherGroupMembers = 2;
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
            var privateConversations = await _context.ChatConversations
                .AsNoTracking()
                .Include(c => c.UserA)
                    .ThenInclude(u => u!.Profile)
                .Include(c => c.UserB)
                    .ThenInclude(u => u!.Profile)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.Sender)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.DeletedForUsers)
                .Where(c =>
                    !c.IsGroup &&
                    ((c.UserAId == userId && !c.IsHiddenForUserA) ||
                     (c.UserBId == userId && !c.IsHiddenForUserB)))
                .ToListAsync();

            var groupConversations = await _context.ChatConversations
                .AsNoTracking()
                .Include(c => c.Members.Where(member => member.LeftAt == null))
                    .ThenInclude(member => member.User)
                        .ThenInclude(u => u!.Profile)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.Sender)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.DeletedForUsers)
                .Where(c => c.IsGroup && c.Members.Any(member => member.UserId == userId && member.LeftAt == null && !member.IsHidden))
                .ToListAsync();

            return privateConversations
                .Select(c => MapConversation(c, userId))
                .Concat(groupConversations.Select(c => MapConversation(c, userId)))
                .OrderByDescending(c => c.LastMessageAt ?? DateTime.MinValue)
                .ToList();
        }

        public async Task<List<ChatMessageDto>> GetMessagesAsync(int userId, int conversationId)
        {
            var conversation = await GetConversationForUser(conversationId, userId);

            var messages = await _context.ChatMessages
                .AsNoTracking()
                .Include(m => m.Sender)
                    .ThenInclude(u => u!.Profile)
                .Include(m => m.DeletedForUsers)
                .Include(m => m.Reactions)
                .Where(m => m.ConversationId == conversation.Id)
                .OrderBy(m => m.CreatedAt)
                .ThenBy(m => m.Id)
                .ToListAsync();

            var visibleMessages = messages.Where(message => IsMessageVisibleToUser(message, conversation, userId));
            return visibleMessages.Select(message => MapMessage(message, userId)).ToList();
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
                    .ThenInclude(m => m.Sender)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.DeletedForUsers)
                .FirstOrDefaultAsync(c => !c.IsGroup && c.UserAId == firstId && c.UserBId == secondId);

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

                conversation = await LoadConversationForDto(conversation.Id);
            }
            else
            {
                SetHiddenForUser(conversation, userId, false);
                await _context.SaveChangesAsync();
            }

            return MapConversation(conversation, userId);
        }

        public async Task<ChatConversationDto> CreateGroupConversationAsync(int userId, CreateGroupChatRequestDto request)
        {
            await EnsureCanUseUserChat(userId);

            var groupName = request.GroupName?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(groupName))
                throw new InvalidOperationException("Group name is required.");

            if (groupName.Length > MaxGroupNameLength)
                throw new InvalidOperationException($"Group name cannot be longer than {MaxGroupNameLength} characters.");

            var memberIds = request.MemberUserIds
                .Where(id => id != userId)
                .Distinct()
                .ToList();

            if (memberIds.Count < MinOtherGroupMembers)
                throw new InvalidOperationException("A group chat needs at least two other members.");

            var users = await _context.Users
                .Include(u => u.Profile)
                .Where(u => memberIds.Contains(u.Id) && u.IsActive)
                .ToListAsync();

            if (users.Count != memberIds.Count)
                throw new KeyNotFoundException("One or more selected users do not exist.");

            if (users.Any(user => !IsOrdinaryUser(user)))
                throw new UnauthorizedAccessException("Groups can include only ordinary users.");

            var now = DateTime.UtcNow;
            var conversation = new ChatConversation
            {
                IsGroup = true,
                GroupName = groupName,
                CreatedByUserId = userId,
                CreatedAt = now,
                Members = memberIds
                    .Prepend(userId)
                    .Select(id => new ChatConversationMember
                    {
                        UserId = id,
                        JoinedAt = now,
                        LastReadAt = id == userId ? now : null,
                        Role = id == userId ? "Admin" : "Member"
                    })
                    .ToList()
            };

            _context.ChatConversations.Add(conversation);
            await _context.SaveChangesAsync();

            conversation = await LoadConversationForDto(conversation.Id);
            return MapConversation(conversation, userId);
        }

        public async Task<GroupChatSettingsDto> GetGroupSettingsAsync(int userId, int conversationId)
        {
            var conversation = await LoadGroupConversationForSettings(conversationId, userId);
            return MapGroupSettings(conversation, userId);
        }

        public async Task<GroupChatSettingsDto> UpdateGroupAsync(int userId, int conversationId, UpdateGroupChatDto request)
        {
            var conversation = await LoadGroupConversationForSettings(conversationId, userId);
            EnsureGroupAdmin(conversation, userId);

            var groupName = request.GroupName?.Trim() ?? conversation.GroupName ?? string.Empty;
            if (string.IsNullOrWhiteSpace(groupName))
                throw new InvalidOperationException("Group name is required.");

            if (groupName.Length > MaxGroupNameLength)
                throw new InvalidOperationException($"Group name cannot be longer than {MaxGroupNameLength} characters.");

            var groupPhoto = request.GroupPhoto?.Trim();
            if (!string.IsNullOrWhiteSpace(groupPhoto))
            {
                if (groupPhoto.Length > MaxGroupPhotoLength)
                    throw new InvalidOperationException("Group photo is too large.");

                if (!groupPhoto.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase) &&
                    !Uri.IsWellFormedUriString(groupPhoto, UriKind.Absolute))
                    throw new InvalidOperationException("Group photo must be an image data URL or absolute URL.");
            }

            conversation.GroupName = groupName;
            if (request.GroupPhoto != null)
            {
                conversation.GroupPhoto = string.IsNullOrWhiteSpace(groupPhoto) ? null : groupPhoto;
            }

            await _context.SaveChangesAsync();

            return MapGroupSettings(conversation, userId);
        }

        public async Task<GroupChatSettingsDto> SetGroupMuteAsync(int userId, int conversationId, UpdateGroupMuteDto request)
        {
            var conversation = await LoadGroupConversationForSettings(conversationId, userId);
            var currentMember = GetActiveMember(conversation, userId);
            currentMember.IsMuted = request.IsMuted;
            await _context.SaveChangesAsync();

            return MapGroupSettings(conversation, userId);
        }

        public async Task RemoveGroupMemberAsync(int userId, int conversationId, int memberUserId)
        {
            var conversation = await LoadGroupConversationForSettings(conversationId, userId);
            EnsureGroupAdmin(conversation, userId);

            if (userId == memberUserId)
                throw new InvalidOperationException("Use Leave group to remove yourself.");

            var member = conversation.Members.FirstOrDefault(member => member.UserId == memberUserId && member.LeftAt == null);
            if (member == null)
                throw new KeyNotFoundException("Group member does not exist.");

            member.LeftAt = DateTime.UtcNow;
            member.IsHidden = true;
            await _context.SaveChangesAsync();
        }

        public async Task LeaveGroupAsync(int userId, int conversationId)
        {
            var conversation = await LoadGroupConversationForSettings(conversationId, userId);
            var currentMember = GetActiveMember(conversation, userId);

            if (IsGroupAdmin(currentMember) && conversation.Members.Count(member => member.LeftAt == null && IsGroupAdmin(member)) == 1)
                throw new InvalidOperationException("Assign another admin before leaving.");

            currentMember.LeftAt = DateTime.UtcNow;
            currentMember.IsHidden = true;
            await _context.SaveChangesAsync();
        }

        public async Task DeleteGroupAsync(int userId, int conversationId)
        {
            var conversation = await LoadGroupConversationForSettings(conversationId, userId);
            EnsureGroupAdmin(conversation, userId);

            _context.ChatConversations.Remove(conversation);
            await _context.SaveChangesAsync();
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
            int? receiverId = null;

            if (!conversation.IsGroup)
            {
                receiverId = conversation.UserAId == userId ? conversation.UserBId : conversation.UserAId;
                var receiver = await _context.Users.FirstOrDefaultAsync(u => u.Id == receiverId && u.IsActive);
                if (receiver == null)
                    throw new KeyNotFoundException("Receiver does not exist.");

                if (!IsOrdinaryUser(receiver))
                    throw new UnauthorizedAccessException("You can only message ordinary users.");
            }

            var message = new ChatMessage
            {
                ConversationId = conversation.Id,
                SenderId = userId,
                ReceiverId = receiverId,
                Body = body,
                CreatedAt = DateTime.UtcNow
            };

            conversation.LastMessageAt = message.CreatedAt;
            if (conversation.IsGroup)
            {
                foreach (var member in conversation.Members.Where(member => member.LeftAt == null))
                {
                    member.IsHidden = false;
                }
            }
            else
            {
                SetHiddenForUser(conversation, userId, false);
                if (receiverId.HasValue)
                {
                    SetHiddenForUser(conversation, receiverId.Value, false);
                }
            }

            _context.ChatMessages.Add(message);
            await _context.SaveChangesAsync();

            message.Sender = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
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

            var message = await _context.ChatMessages
                .Include(m => m.Conversation)
                    .ThenInclude(c => c!.Members)
                .Include(m => m.Sender)
                    .ThenInclude(u => u!.Profile)
                .Include(m => m.DeletedForUsers)
                .Include(m => m.Reactions)
                .FirstOrDefaultAsync(m => m.Id == messageId);
            if (message == null)
                throw new KeyNotFoundException("Message does not exist.");

            EnsureUserCanAccessConversation(message.Conversation!, userId);

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
            if (conversation.IsGroup)
            {
                var member = conversation.Members.First(m => m.UserId == userId && m.LeftAt == null);
                member.IsHidden = true;
            }
            else
            {
                SetHiddenForUser(conversation, userId, true);
            }

            await _context.SaveChangesAsync();
        }

        public async Task<ChatMessageDto> DeleteMessageForEveryoneAsync(int userId, int messageId)
        {
            await EnsureCanUseUserChat(userId);

            var message = await _context.ChatMessages
                .Include(m => m.Conversation)
                    .ThenInclude(c => c!.Members)
                .Include(m => m.Sender)
                    .ThenInclude(u => u!.Profile)
                .Include(m => m.DeletedForUsers)
                .Include(m => m.Reactions)
                .FirstOrDefaultAsync(m => m.Id == messageId);
            if (message == null)
                throw new KeyNotFoundException("Message does not exist.");

            EnsureUserCanAccessConversation(message.Conversation!, userId);

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

            if (conversation.IsGroup)
            {
                var member = conversation.Members.First(m => m.UserId == userId && m.LeftAt == null);
                member.LastReadAt = now;
            }
            else
            {
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
            }

            await _context.SaveChangesAsync();
        }

        public async Task DeleteMessageForUserAsync(int userId, int messageId)
        {
            var message = await _context.ChatMessages
                .Include(m => m.Conversation)
                    .ThenInclude(c => c!.Members)
                .Include(m => m.DeletedForUsers)
                .FirstOrDefaultAsync(m => m.Id == messageId);

            if (message == null)
                throw new KeyNotFoundException("Message does not exist.");

            EnsureUserCanAccessConversation(message.Conversation!, userId);

            if (message.Conversation!.IsGroup)
            {
                if (!message.DeletedForUsers.Any(deletion => deletion.UserId == userId))
                {
                    message.DeletedForUsers.Add(new ChatMessageUserDeletion
                    {
                        UserId = userId,
                        DeletedAt = DateTime.UtcNow
                    });
                }
            }
            else if (message.SenderId == userId)
            {
                message.IsDeletedForSender = true;
            }
            else if (message.ReceiverId == userId)
            {
                message.IsDeletedForReceiver = true;
            }
            else
            {
                throw new UnauthorizedAccessException("You cannot delete this message.");
            }

            await _context.SaveChangesAsync();
        }

        public async Task<ChatMessageDto> ToggleReactionAsync(int userId, int messageId, ToggleChatMessageReactionDto request)
        {
            await EnsureCanUseUserChat(userId);

            var emoji = request.Emoji?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(emoji))
                throw new InvalidOperationException("Reaction emoji is required.");

            if (emoji.Length > MaxReactionEmojiLength)
                throw new InvalidOperationException($"Reaction emoji cannot be longer than {MaxReactionEmojiLength} characters.");

            var message = await LoadMessageForReaction(messageId, userId);
            var existingReaction = message.Reactions.FirstOrDefault(reaction => reaction.UserId == userId);

            if (existingReaction == null)
            {
                message.Reactions.Add(new ChatMessageReaction
                {
                    UserId = userId,
                    Emoji = emoji,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else if (string.Equals(existingReaction.Emoji, emoji, StringComparison.Ordinal))
            {
                message.Reactions.Remove(existingReaction);
                _context.ChatMessageReactions.Remove(existingReaction);
            }
            else
            {
                existingReaction.Emoji = emoji;
                existingReaction.CreatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return MapMessage(message, userId);
        }

        public async Task<ChatMessageDto> RemoveReactionAsync(int userId, int messageId)
        {
            await EnsureCanUseUserChat(userId);

            var message = await LoadMessageForReaction(messageId, userId);
            var existingReaction = message.Reactions.FirstOrDefault(reaction => reaction.UserId == userId);

            if (existingReaction != null)
            {
                message.Reactions.Remove(existingReaction);
                _context.ChatMessageReactions.Remove(existingReaction);
                await _context.SaveChangesAsync();
            }

            return MapMessage(message, userId);
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
                .Include(c => c.Members)
                .FirstOrDefaultAsync(c =>
                    c.Id == conversationId &&
                    ((!c.IsGroup && (c.UserAId == userId || c.UserBId == userId)) ||
                     (c.IsGroup && c.Members.Any(m => m.UserId == userId && m.LeftAt == null))));

            if (conversation == null)
                throw new UnauthorizedAccessException("Conversation is not available.");

            return conversation;
        }

        private async Task<ChatConversation> LoadConversationForDto(int conversationId)
        {
            return await _context.ChatConversations
                .Include(c => c.UserA)
                    .ThenInclude(u => u!.Profile)
                .Include(c => c.UserB)
                    .ThenInclude(u => u!.Profile)
                .Include(c => c.Members.Where(member => member.LeftAt == null))
                    .ThenInclude(member => member.User)
                        .ThenInclude(u => u!.Profile)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.Sender)
                .Include(c => c.Messages)
                    .ThenInclude(m => m.DeletedForUsers)
                .FirstAsync(c => c.Id == conversationId);
        }

        private static void EnsureUserCanAccessConversation(ChatConversation conversation, int userId)
        {
            if (conversation.IsGroup)
            {
                if (!conversation.Members.Any(member => member.UserId == userId && member.LeftAt == null))
                    throw new UnauthorizedAccessException("Conversation is not available.");

                return;
            }

            if (conversation.UserAId != userId && conversation.UserBId != userId)
                throw new UnauthorizedAccessException("Conversation is not available.");
        }

        private static bool IsMessageVisibleToUser(ChatMessage message, ChatConversation conversation, int userId)
        {
            if (conversation.IsGroup)
                return !message.DeletedForUsers.Any(deletion => deletion.UserId == userId);

            return (message.SenderId == userId && !message.IsDeletedForSender) ||
                   (message.ReceiverId == userId && !message.IsDeletedForReceiver);
        }

        private async Task<ChatMessage> LoadMessageForReaction(int messageId, int userId)
        {
            var message = await _context.ChatMessages
                .Include(m => m.Conversation)
                    .ThenInclude(c => c!.Members)
                .Include(m => m.Sender)
                    .ThenInclude(u => u!.Profile)
                .Include(m => m.DeletedForUsers)
                .Include(m => m.Reactions)
                .FirstOrDefaultAsync(m => m.Id == messageId);

            if (message == null)
                throw new KeyNotFoundException("Message does not exist.");

            var conversation = message.Conversation!;
            EnsureUserCanAccessConversation(conversation, userId);

            if (!IsMessageVisibleToUser(message, conversation, userId))
                throw new UnauthorizedAccessException("Message is not available.");

            if (message.IsDeletedForEveryone)
                throw new InvalidOperationException("Deleted messages cannot receive reactions.");

            return message;
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
            if (conversation.IsGroup)
            {
                var currentMember = conversation.Members.FirstOrDefault(member => member.UserId == currentUserId);
                var lastVisibleMessage = conversation.Messages
                    .Where(m => IsMessageVisibleToUser(m, conversation, currentUserId))
                    .OrderByDescending(m => m.CreatedAt)
                    .ThenByDescending(m => m.Id)
                    .FirstOrDefault();
                var groupName = conversation.GroupName ?? "Group chat";
                var members = conversation.Members
                    .Where(member => member.LeftAt == null && member.User != null)
                    .OrderBy(member => member.JoinedAt)
                    .ToList();

                return new ChatConversationDto
                {
                    ConversationId = conversation.Id,
                    IsGroup = true,
                    IsEventThread = false,
                    EventId = null,
                    GroupName = groupName,
                    GroupPhoto = conversation.GroupPhoto,
                    DisplayName = groupName,
                    MemberCount = members.Count,
                    MemberInitials = members.Select(member => GetInitials(member.User!.Username)).Take(4).ToList(),
                    OtherDisplayName = groupName,
                    OtherUsername = groupName,
                    OtherInitials = GetInitials(groupName),
                    LastMessagePreview = lastVisibleMessage?.Body,
                    LastMessageAt = conversation.LastMessageAt ?? lastVisibleMessage?.CreatedAt ?? conversation.CreatedAt,
                    UnreadCount = conversation.Messages.Count(m =>
                        !m.IsDeletedForEveryone &&
                        m.SenderId != currentUserId &&
                        !m.DeletedForUsers.Any(deletion => deletion.UserId == currentUserId) &&
                        (currentMember?.LastReadAt == null || m.CreatedAt > currentMember.LastReadAt)),
                    IsHidden = currentMember?.IsHidden ?? false
                };
            }

            var otherUser = conversation.UserAId == currentUserId ? conversation.UserB! : conversation.UserA!;
            var privateLastVisibleMessage = conversation.Messages
                .Where(m => IsMessageVisibleToUser(m, conversation, currentUserId))
                .OrderByDescending(m => m.CreatedAt)
                .ThenByDescending(m => m.Id)
                .FirstOrDefault();

            return new ChatConversationDto
            {
                ConversationId = conversation.Id,
                IsGroup = false,
                IsEventThread = false,
                EventId = null,
                DisplayName = otherUser.Username,
                MemberCount = 2,
                OtherUserId = otherUser.Id,
                OtherUsername = otherUser.Username,
                OtherDisplayName = otherUser.Username,
                OtherInitials = GetInitials(otherUser.Username),
                OtherAvatar = otherUser.Profile?.ProfilePicture,
                LastMessagePreview = privateLastVisibleMessage?.Body,
                LastMessageAt = conversation.LastMessageAt ?? privateLastVisibleMessage?.CreatedAt ?? conversation.CreatedAt,
                UnreadCount = conversation.Messages.Count(m =>
                    !m.IsDeletedForEveryone &&
                    m.ReceiverId == currentUserId &&
                    m.ReadAt == null &&
                    !m.IsDeletedForReceiver),
                IsHidden = conversation.UserAId == currentUserId ? conversation.IsHiddenForUserA : conversation.IsHiddenForUserB
            };
        }

        private static ChatMessageDto MapMessage(ChatMessage message, int currentUserId)
        {
            var senderName = message.Sender?.Username;
            var reactions = message.IsDeletedForEveryone
                ? new List<ChatMessageReactionDto>()
                : message.Reactions
                    .GroupBy(reaction => reaction.Emoji)
                    .Select(group => new ChatMessageReactionDto
                    {
                        Emoji = group.Key,
                        Count = group.Count(),
                        ReactedByCurrentUser = group.Any(reaction => reaction.UserId == currentUserId)
                    })
                    .OrderByDescending(reaction => reaction.ReactedByCurrentUser)
                    .ThenByDescending(reaction => reaction.Count)
                    .ThenBy(reaction => reaction.Emoji)
                    .ToList();

            return new ChatMessageDto
            {
                Id = message.Id,
                ConversationId = message.ConversationId,
                SenderId = message.SenderId,
                ReceiverId = message.ReceiverId,
                SenderUsername = senderName,
                SenderDisplayName = senderName,
                SenderInitials = senderName == null ? null : GetInitials(senderName),
                Body = message.Body,
                CreatedAt = message.CreatedAt,
                ReadAt = message.ReadAt,
                EditedAt = message.EditedAt,
                IsDeletedForEveryone = message.IsDeletedForEveryone,
                DeletedAt = message.DeletedAt,
                IsMine = message.SenderId == currentUserId,
                Reactions = reactions,
                CurrentUserReaction = message.IsDeletedForEveryone
                    ? null
                    : message.Reactions.FirstOrDefault(reaction => reaction.UserId == currentUserId)?.Emoji
            };
        }

        private async Task<ChatConversation> LoadGroupConversationForSettings(int conversationId, int userId)
        {
            var conversation = await _context.ChatConversations
                .Include(c => c.CreatedByUser)
                .Include(c => c.Members.Where(member => member.LeftAt == null))
                    .ThenInclude(member => member.User)
                        .ThenInclude(u => u!.Profile)
                .FirstOrDefaultAsync(c => c.Id == conversationId);

            if (conversation == null)
                throw new KeyNotFoundException("Group conversation does not exist.");

            if (!conversation.IsGroup)
                throw new InvalidOperationException("Settings are available for group chats.");

            if (!conversation.Members.Any(member => member.UserId == userId && member.LeftAt == null))
                throw new UnauthorizedAccessException("You are no longer a member of this group.");

            return conversation;
        }

        private static ChatConversationMember GetActiveMember(ChatConversation conversation, int userId)
        {
            var member = conversation.Members.FirstOrDefault(member => member.UserId == userId && member.LeftAt == null);
            if (member == null)
                throw new UnauthorizedAccessException("Group is not available.");

            return member;
        }

        private static void EnsureGroupAdmin(ChatConversation conversation, int userId)
        {
            if (!IsGroupAdmin(GetActiveMember(conversation, userId)))
                throw new UnauthorizedAccessException("Only group admins can do this.");
        }

        private static bool IsGroupAdmin(ChatConversationMember member)
        {
            return string.Equals(member.Role, "Admin", StringComparison.OrdinalIgnoreCase) ||
                   string.Equals(member.Role, "Owner", StringComparison.OrdinalIgnoreCase);
        }

        private static GroupChatSettingsDto MapGroupSettings(ChatConversation conversation, int currentUserId)
        {
            var currentMember = GetActiveMember(conversation, currentUserId);
            var members = conversation.Members
                .Where(member => member.LeftAt == null && member.User != null)
                .OrderByDescending(IsGroupAdmin)
                .ThenBy(member => member.User!.Username)
                .ToList();

            return new GroupChatSettingsDto
            {
                ConversationId = conversation.Id,
                GroupName = conversation.GroupName ?? "Group chat",
                GroupPhoto = conversation.GroupPhoto,
                MemberCount = members.Count,
                CurrentUserRole = NormalizeGroupRole(currentMember.Role),
                IsCurrentUserAdmin = IsGroupAdmin(currentMember),
                IsMuted = currentMember.IsMuted,
                CreatedByUsername = conversation.CreatedByUser?.Username,
                Members = members.Select(member => new GroupChatMemberDto
                {
                    UserId = member.UserId,
                    Username = member.User!.Username,
                    DisplayName = member.User.Username,
                    Initials = GetInitials(member.User.Username),
                    Avatar = member.User.Profile?.ProfilePicture,
                    Role = NormalizeGroupRole(member.Role),
                    IsAdmin = IsGroupAdmin(member),
                    IsCurrentUser = member.UserId == currentUserId
                }).ToList()
            };
        }

        private static string NormalizeGroupRole(string? role)
        {
            return string.Equals(role, "Owner", StringComparison.OrdinalIgnoreCase) ? "Admin" : role ?? "Member";
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
