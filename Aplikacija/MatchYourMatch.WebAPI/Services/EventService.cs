using MatchYourMatch.WebAPI.Data;
using MatchYourMatch.WebAPI.DTOs.Event;
using MatchYourMatch.WebAPI.DTOs.Chat;
using MatchYourMatch.WebAPI.Models;
using MatchYourMatch.WebAPI.Services.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace MatchYourMatch.WebAPI.Services
{
    public class EventService: IEventService
    {
        private const int MaxDiscussionMessageLength = 2000;
        private const int MinimumAllowedEventAge = 13;
        private const int MaximumAllowedEventAge = 100;
        private readonly AppDbContext _context;
        private readonly IGeocodingService _geocodingService;
        private readonly INotificationService _notifications;
        private readonly IMessageAttachmentStorage _attachmentStorage;

        public EventService(AppDbContext context, IGeocodingService geocodingService, INotificationService notifications, IMessageAttachmentStorage attachmentStorage)
        {
            _context = context;
            _geocodingService = geocodingService;
            _notifications = notifications;
            _attachmentStorage = attachmentStorage;
        }

        public async Task<List<EventDto>> GetByQueryAsync(
            int currentUserId,
            string? category,
            bool includePast = false)
        {
            var query = _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.SavedByUsers)
                .Include(e => e.JoinRequests)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                        .ThenInclude(u => u.Profile)
                .AsQueryable();

            if (!includePast)
            {
                var localNow = DateTime.Now;
                var today = DateOnly.FromDateTime(localNow);
                var currentTime = TimeOnly.FromDateTime(localNow);

                query = query.Where(e =>
                    e.Date > today ||
                    (e.Date == today && e.Time >= currentTime));
            }

            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(e => e.Interest != null && e.Interest.Name == category);
            }

            var events = await query
                .OrderBy(e => e.Date)
                .ThenBy(e => e.Time)
                .ToListAsync();

            return events.Select(e => ToDto(e, currentUserId)).ToList();
        }

        public async Task<List<EventDto>> GetGuestByQueryAsync(string city, string? category)
        {
            var query = GuestVisibleEvents(city);

            if (!string.IsNullOrEmpty(category))
            {
                query = query.Where(e => e.Interest != null && e.Interest.Name == category);
            }

            var events = await query
                .OrderBy(e => e.Date)
                .ThenBy(e => e.Time)
                .ToListAsync();

            return events.Select(e => ToDto(e, 0)).ToList();
        }

        public async Task<EventDto> GetGuestByIdAsync(int id, string city)
        {
            var e = await GuestVisibleEvents(city).FirstOrDefaultAsync(e => e.Id == id);
            if (e == null)
                throw new KeyNotFoundException("Event does not exist.");

            return ToDto(e, 0);
        }

        public async Task<List<string>> GetGuestCitiesAsync()
        {
            var localNow = DateTime.Now;
            var today = DateOnly.FromDateTime(localNow);
            var currentTime = TimeOnly.FromDateTime(localNow);

            return await _context.Events.AsNoTracking()
                .Where(e => e.Organizer != null &&
                    e.Organizer.Role == "Organizer" &&
                    e.LocationCity != null &&
                    e.LocationCity != "" &&
                    (e.Date > today || (e.Date == today && e.Time >= currentTime)))
                .Select(e => e.LocationCity!)
                .Distinct()
                .OrderBy(city => city)
                .ToListAsync();
        }

        public async Task<ProfileEventsDto> GetProfileEventsAsync(int currentUserId)
        {
            var events = await _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.SavedByUsers)
                .Include(e => e.JoinRequests)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                        .ThenInclude(u => u.Profile)
                .Where(e =>
                    e.Participants.Any(p => p.UserId == currentUserId) ||
                    e.OrganizerId == currentUserId ||
                    e.SavedByUsers.Any(saved => saved.UserId == currentUserId))
                .OrderBy(e => e.Date)
                .ThenBy(e => e.Time)
                .ToListAsync();

            var now = DateTime.Now;
            var joinedEvents = events
                .Where(e => e.Participants.Any(p => p.UserId == currentUserId) || e.OrganizerId == currentUserId)
                .Select(e => ToDto(e, currentUserId))
                .ToList();

            return new ProfileEventsDto
            {
                Upcoming = joinedEvents
                    .Where(e => ToEventDateTime(e) >= now)
                    .ToList(),
                Past = joinedEvents
                    .Where(e => ToEventDateTime(e) < now)
                    .OrderByDescending(e => e.Date)
                    .ThenByDescending(e => e.Time)
                    .ToList(),
                Saved = events
                    .Where(e => e.SavedByUsers.Any(saved => saved.UserId == currentUserId))
                    .OrderByDescending(e => e.SavedByUsers.First(saved => saved.UserId == currentUserId).SavedAt)
                    .Select(e => ToDto(e, currentUserId))
                    .ToList()
            };
        }

        public async Task<List<EventDto>> GetSavedEventsAsync(int currentUserId)
        {
            var events = await _context.SavedEvents.AsNoTracking()
                .Where(saved => saved.UserId == currentUserId)
                .OrderByDescending(saved => saved.SavedAt)
                .Select(saved => saved.EventId)
                .ToListAsync();
            if (events.Count == 0) return new List<EventDto>();

            var details = await _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.SavedByUsers)
                .Include(e => e.JoinRequests)
                .Include(e => e.Participants).ThenInclude(p => p.User).ThenInclude(u => u.Profile)
                .Where(e => events.Contains(e.Id))
                .ToListAsync();
            return details.OrderBy(e => events.IndexOf(e.Id)).Select(e => ToDto(e, currentUserId)).ToList();
        }

        public async Task<EventDto> SaveEventAsync(int eventId, int currentUserId)
        {
            if (!await _context.Events.AnyAsync(e => e.Id == eventId))
                throw new KeyNotFoundException("Event does not exist.");
            if (!await _context.SavedEvents.AnyAsync(saved => saved.UserId == currentUserId && saved.EventId == eventId))
            {
                _context.SavedEvents.Add(new SavedEvent { UserId = currentUserId, EventId = eventId });
                try { await _context.SaveChangesAsync(); }
                catch (DbUpdateException) { _context.ChangeTracker.Clear(); }
            }
            return await GetByIdAsync(eventId, currentUserId);
        }

        public async Task UnsaveEventAsync(int eventId, int currentUserId)
        {
            if (!await _context.Events.AnyAsync(e => e.Id == eventId))
                throw new KeyNotFoundException("Event does not exist.");
            await _context.SavedEvents
                .Where(saved => saved.UserId == currentUserId && saved.EventId == eventId)
                .ExecuteDeleteAsync();
        }

        public async Task<EventDto> GetByIdAsync(int id, int currentUserId)
        {
            var e = await _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.SavedByUsers)
                .Include(e => e.JoinRequests)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                        .ThenInclude(u => u.Profile)
                .FirstOrDefaultAsync(e => e.Id == id);
            if (e == null)
                throw new Exception("Event ne postoji");

            return ToDto(e, currentUserId);
        }

        public async Task<EventDto> CreateAsync(int userId, CreateEventDto dto)
        {
            var role = await _context.Users.AsNoTracking()
                .Where(user => user.Id == userId)
                .Select(user => user.Role)
                .FirstOrDefaultAsync();
            if (!string.Equals(role, "Organizer", StringComparison.OrdinalIgnoreCase))
                throw new UnauthorizedAccessException("Only organizers can create events.");

            ValidateEvent(dto);
            var location = await ResolveLocationAsync(dto.Location);
            var category = NormalizeCategory(dto.Category);
            var interest = await _context.Interests.FirstOrDefaultAsync(i => i.Name == category);
            if (interest == null)
            {
                interest = new Interest
                {
                    Name = category,
                    Category = "Event"
                };
                _context.Interests.Add(interest);
                await _context.SaveChangesAsync();
            }

            var e = new Event
            {
                Title = dto.Title,
                OrganizerId = userId,
                InterestId = interest.Id,
                Date = dto.Date,
                Time = dto.Time,
                Location = location.LocationInput,
                LocationCity = location.City,
                LocationCountry = location.Country,
                Latitude = location.Latitude,
                Longitude = location.Longitude,
                ShowFullAddress = dto.ShowFullAddress,
                MaxAttendees = dto.MaxAttendees <= 0 ? 10 : dto.MaxAttendees,
                MinAge = dto.MinAge,
                MaxAge = dto.MaxAge,
                RequiresParticipantApproval = dto.RequiresParticipantApproval,
                Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
                ImageUrl = dto.ImageUrl
            };

            _context.Events.Add(e);
            _context.EventParticipants.Add(new EventParticipant
            {
                Event = e,
                UserId = userId
            });
            await _context.SaveChangesAsync();

            return await GetByIdAsync(e.Id, userId);
        }

        public async Task<EventDto> JoinAsync(int eventId, int userId)
        {
            var e = await _context.Events
                .Include(e => e.Participants)
                .Include(e => e.JoinRequests)
                .FirstOrDefaultAsync(e => e.Id == eventId);

            if (e == null)
                throw new KeyNotFoundException("Event does not exist.");

            if (e.Participants.Any(p => p.UserId == userId))
                return await GetByIdAsync(eventId, userId);

            await EnsureJoinAllowedAsync(e, userId, checkCapacity: !e.RequiresParticipantApproval);
            var username = await _context.Users.Where(user => user.Id == userId)
                .Select(user => user.Username).FirstAsync();

            if (e.RequiresParticipantApproval)
            {
                var request = e.JoinRequests.FirstOrDefault(value => value.UserId == userId);
                if (request?.Status == "Pending")
                    return await GetByIdAsync(eventId, userId);

                if (request == null)
                {
                    request = new EventJoinRequest { EventId = eventId, UserId = userId };
                    _context.EventJoinRequests.Add(request);
                }
                else
                {
                    request.Status = "Pending";
                    request.CreatedAt = DateTime.UtcNow;
                    request.RespondedAt = null;
                }

                await _context.SaveChangesAsync();
                if (e.OrganizerId.HasValue)
                {
                    await _notifications.CreateNotificationAsync(e.OrganizerId.Value, userId,
                        "EventJoinRequest", "New join request",
                        $"{username} requested to join {e.Title}.", "EventJoinRequest", request.Id);
                }
                return await GetByIdAsync(eventId, userId);
            }

            _context.EventParticipants.Add(new EventParticipant { EventId = eventId, UserId = userId });
            await _context.SaveChangesAsync();
            if (e.OrganizerId.HasValue)
            {
                await _notifications.CreateNotificationAsync(e.OrganizerId.Value, userId,
                    "EventParticipantJoined", "New event participant",
                    $"{username} joined {e.Title}.", "Event", eventId);
            }

            return await GetByIdAsync(eventId, userId);
        }

        public async Task<EventDto> LeaveAsync(int eventId, int userId)
        {
            var e = await _context.Events
                .Include(e => e.Participants)
                .FirstOrDefaultAsync(e => e.Id == eventId);

            if (e == null)
                throw new KeyNotFoundException("Event does not exist.");

            if (e.OrganizerId == userId)
                throw new InvalidOperationException("You cannot leave an event you created.");

            if (e.Date.ToDateTime(e.Time) <= DateTime.Now)
                throw new InvalidOperationException("You cannot leave an event that has already started.");

            var participant = e.Participants.FirstOrDefault(p => p.UserId == userId);
            if (participant == null)
                return await GetByIdAsync(eventId, userId);

            _context.EventParticipants.Remove(participant);
            await _context.SaveChangesAsync();

            return await GetByIdAsync(eventId, userId);
        }

        public async Task<EventDto> CancelJoinRequestAsync(int eventId, int userId)
        {
            var request = await _context.EventJoinRequests
                .FirstOrDefaultAsync(value => value.EventId == eventId && value.UserId == userId && value.Status == "Pending")
                ?? throw new KeyNotFoundException("Pending join request does not exist.");
            _context.EventJoinRequests.Remove(request);
            await _context.SaveChangesAsync();
            return await GetByIdAsync(eventId, userId);
        }

        public async Task<List<EventJoinRequestDto>> GetJoinRequestsAsync(int eventId, int organizerId)
        {
            await EnsureOrganizerAsync(eventId, organizerId);
            return await _context.EventJoinRequests.AsNoTracking()
                .Where(request => request.EventId == eventId && request.Status == "Pending")
                .OrderBy(request => request.CreatedAt)
                .Select(request => new EventJoinRequestDto
                {
                    Id = request.Id,
                    EventId = request.EventId,
                    UserId = request.UserId,
                    Username = request.User.Username,
                    DisplayName = request.User.Profile != null && request.User.Profile.ShowFullName
                        ? request.User.Profile.FullName : request.User.Username,
                    ProfilePicture = request.User.Profile != null ? request.User.Profile.ProfilePicture : null,
                    Status = request.Status,
                    CreatedAt = request.CreatedAt,
                    RespondedAt = request.RespondedAt
                }).ToListAsync();
        }

        public async Task<EventDto> RespondToJoinRequestAsync(
            int eventId, int requestId, int organizerId, bool accept)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync();
            var e = await _context.Events
                .Include(value => value.Participants)
                .FirstOrDefaultAsync(value => value.Id == eventId)
                ?? throw new KeyNotFoundException("Event does not exist.");
            if (e.OrganizerId != organizerId)
                throw new UnauthorizedAccessException("Only the event organizer can review join requests.");

            var request = await _context.EventJoinRequests
                .Include(value => value.User)
                .FirstOrDefaultAsync(value => value.Id == requestId && value.EventId == eventId)
                ?? throw new KeyNotFoundException("Join request does not exist.");
            if (request.Status != "Pending")
                throw new InvalidOperationException("This join request has already been reviewed.");

            if (accept)
            {
                await EnsureJoinAllowedAsync(e, request.UserId, checkCapacity: true);
                if (!e.Participants.Any(participant => participant.UserId == request.UserId))
                    _context.EventParticipants.Add(new EventParticipant { EventId = eventId, UserId = request.UserId });
            }

            request.Status = accept ? "Accepted" : "Rejected";
            request.RespondedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var reviewedAt = DateTime.UtcNow;
            await _context.Notifications
                .Where(notification => notification.UserId == organizerId &&
                    notification.Type == "EventJoinRequest" &&
                    notification.ActorUserId == request.UserId &&
                    ((notification.RelatedEntityType == "Event" &&
                        notification.RelatedEntityId == eventId) ||
                     (notification.RelatedEntityType == "EventJoinRequest" &&
                        notification.RelatedEntityId == request.Id)) &&
                    !notification.IsRead)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(notification => notification.IsRead, true)
                    .SetProperty(notification => notification.ReadAt, reviewedAt));

            await _notifications.CreateNotificationAsync(request.UserId, organizerId,
                accept ? "EventJoinAccepted" : "EventJoinRejected",
                accept ? "Join request accepted" : "Join request rejected",
                accept
                    ? $"Your request to join {e.Title} was accepted."
                    : $"Your request to join {e.Title} was rejected.",
                "Event", eventId);
            await transaction.CommitAsync();
            return await GetByIdAsync(eventId, organizerId);
        }

        public async Task<List<EventDiscussionMessageDto>> GetDiscussionAsync(int eventId, int userId)
        {
            await EnsureEventParticipantAsync(eventId, userId);

            var messages = await _context.EventDiscussionMessages
                .AsNoTracking()
                .Include(m => m.User)
                    .ThenInclude(u => u!.Profile)
                .Include(m => m.Attachment)
                .Where(m => m.EventId == eventId && !m.IsDeleted)
                .OrderBy(m => m.CreatedAt)
                .ThenBy(m => m.Id)
                .ToListAsync();

            return messages.Select(message => ToDiscussionDto(message, userId)).ToList();
        }

        public async Task<EventDiscussionMessageDto> AddDiscussionMessageAsync(int eventId, int userId, CreateEventDiscussionMessageDto dto)
        {
            await EnsureEventParticipantAsync(eventId, userId);

            var body = dto.Body?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(body))
                throw new InvalidOperationException("Message cannot be empty.");

            if (body.Length > MaxDiscussionMessageLength)
                throw new InvalidOperationException($"Message cannot be longer than {MaxDiscussionMessageLength} characters.");

            var message = new EventDiscussionMessage
            {
                EventId = eventId,
                UserId = userId,
                Body = body,
                CreatedAt = DateTime.UtcNow
            };

            _context.EventDiscussionMessages.Add(message);
            await _context.SaveChangesAsync();

            message.User = await _context.Users
                .Include(u => u.Profile)
                .FirstOrDefaultAsync(u => u.Id == userId);

            return ToDiscussionDto(message, userId);
        }

        public async Task<EventDiscussionMessageDto> AddDiscussionAttachmentAsync(int eventId, int userId, string? body, IFormFile file, CancellationToken cancellationToken = default)
        {
            await EnsureEventParticipantAsync(eventId, userId);
            var attachment = await _attachmentStorage.SaveAsync(file, cancellationToken);
            try { return await CreateDiscussionMediaMessageAsync(eventId, userId, body, attachment); }
            catch { await _attachmentStorage.DeleteAsync(attachment); throw; }
        }

        public async Task<EventDiscussionMessageDto> AddDiscussionGifAsync(int eventId, int userId, SendGifMessageDto dto)
        {
            await EnsureEventParticipantAsync(eventId, userId);
            if (!string.Equals(dto.Provider, "Giphy", StringComparison.OrdinalIgnoreCase) || string.IsNullOrWhiteSpace(dto.GifId) ||
                dto.GifId.Length > 100 || !IsSafeGiphyUrl(dto.OriginalUrl) || !IsSafeGiphyUrl(dto.PreviewUrl))
                throw new InvalidOperationException("Invalid GIPHY selection.");
            return await CreateDiscussionMediaMessageAsync(eventId, userId, dto.Body, new MessageAttachment
            {
                Kind = "Gif", Provider = "Giphy", ProviderMediaId = dto.GifId.Trim(), OriginalUrl = dto.OriginalUrl, PreviewUrl = dto.PreviewUrl
            });
        }

        public async Task<(Stream Stream, string ContentType, string FileName)> DownloadDiscussionAttachmentAsync(int eventId, int userId, int attachmentId, CancellationToken cancellationToken = default)
        {
            await EnsureEventParticipantAsync(eventId, userId);
            var attachment = await _context.MessageAttachments.FirstOrDefaultAsync(a => a.Id == attachmentId && a.EventDiscussionMessage != null && a.EventDiscussionMessage.EventId == eventId, cancellationToken)
                ?? throw new KeyNotFoundException("Attachment does not exist.");
            return (await _attachmentStorage.OpenReadAsync(attachment, cancellationToken), attachment.ContentType ?? "application/octet-stream", attachment.OriginalFileName ?? "attachment");
        }

        private async Task<EventDiscussionMessageDto> CreateDiscussionMediaMessageAsync(int eventId, int userId, string? rawBody, MessageAttachment attachment)
        {
            var body = rawBody?.Trim() ?? string.Empty;
            if (body.Length > MaxDiscussionMessageLength) throw new InvalidOperationException($"Message cannot be longer than {MaxDiscussionMessageLength} characters.");
            var message = new EventDiscussionMessage { EventId = eventId, UserId = userId, Body = body, CreatedAt = DateTime.UtcNow, Attachment = attachment };
            _context.EventDiscussionMessages.Add(message);
            await _context.SaveChangesAsync();
            message.User = await _context.Users.Include(u => u.Profile).FirstOrDefaultAsync(u => u.Id == userId);
            return ToDiscussionDto(message, userId);
        }

        private static bool IsSafeGiphyUrl(string? value) => Uri.TryCreate(value, UriKind.Absolute, out var uri) &&
            uri.Scheme == Uri.UriSchemeHttps && (uri.Host.EndsWith("giphy.com", StringComparison.OrdinalIgnoreCase) || uri.Host.EndsWith("giphyusercontent.com", StringComparison.OrdinalIgnoreCase));

        public async Task UpdateAsync(int organizerId, int eventId, CreateEventDto dto)
        {
            ValidateEvent(dto);
            var e = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
            if (e == null)
                throw new Exception("Event ne postoji");

            if (e.OrganizerId != organizerId)
                throw new Exception("Niste organizator ovog eventa");

            var interest = await _context.Interests.FirstOrDefaultAsync(i => i.Name == NormalizeCategory(dto.Category));
            if (interest == null)
                throw new Exception("Kategorija ne postoji");

            var location = await ResolveLocationAsync(dto.Location);

            e.Title = dto.Title;
            e.InterestId = interest.Id;
            e.Date = dto.Date;
            e.Time = dto.Time;
            e.Location = location.LocationInput;
            e.LocationCity = location.City;
            e.LocationCountry = location.Country;
            e.Latitude = location.Latitude;
            e.Longitude = location.Longitude;
            e.ShowFullAddress = dto.ShowFullAddress;
            e.MaxAttendees = dto.MaxAttendees;
            e.MinAge = dto.MinAge;
            e.MaxAge = dto.MaxAge;
            e.RequiresParticipantApproval = dto.RequiresParticipantApproval;
            e.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();
            e.ImageUrl = dto.ImageUrl;

            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(int organizerId, int eventId)
        {
            var e = await _context.Events.FirstOrDefaultAsync(e => e.Id == eventId);
            if (e == null)
                throw new Exception("Event ne postoji");

            if (e.OrganizerId != organizerId)
                throw new Exception("Niste organizator ovog eventa");

            _context.Events.Remove(e);
            await _context.SaveChangesAsync();
        }

        private static string NormalizeCategory(string value)
        {
            return string.IsNullOrWhiteSpace(value) ? "Social" : value.Trim();
        }

        public async Task<CreateEventDto> GetForEditAsync(int id, int organizerId)
        {
            var e = await _context.Events.Include(value => value.Interest).FirstOrDefaultAsync(value => value.Id == id)
                ?? throw new KeyNotFoundException("Event does not exist.");
            if (e.OrganizerId != organizerId) throw new UnauthorizedAccessException("You can only edit your own event.");
            return new CreateEventDto
            {
                Title = e.Title,
                Category = e.Interest?.Name ?? "Social",
                Description = e.Description,
                Location = e.Location,
                ShowFullAddress = e.ShowFullAddress,
                Date = e.Date,
                Time = e.Time,
                MaxAttendees = e.MaxAttendees,
                MinAge = e.MinAge,
                MaxAge = e.MaxAge,
                RequiresParticipantApproval = e.RequiresParticipantApproval,
                ImageUrl = e.ImageUrl
            };
        }

        private static void ValidateEvent(CreateEventDto dto)
        {
            if (dto.MinAge is < MinimumAllowedEventAge or > MaximumAllowedEventAge ||
                dto.MaxAge is < MinimumAllowedEventAge or > MaximumAllowedEventAge ||
                (dto.MinAge.HasValue && dto.MaxAge.HasValue && dto.MinAge > dto.MaxAge))
            {
                throw new InvalidOperationException("Invalid event age range.");
            }
        }

        private async Task EnsureUserCanJoinByAgeAsync(Event e, int userId)
        {
            if (!e.MinAge.HasValue && !e.MaxAge.HasValue) return;
            var dateOfBirth = await _context.UserProfiles.AsNoTracking()
                .Where(profile => profile.UserId == userId)
                .Select(profile => profile.DateOfBirth)
                .FirstOrDefaultAsync();
            var age = CalculateAge(dateOfBirth);
            if (!age.HasValue)
                throw new InvalidOperationException("Complete your date of birth on your profile before joining this age-restricted event.");
            if (e.MinAge.HasValue && age < e.MinAge.Value)
                throw new InvalidOperationException($"You must be at least {e.MinAge.Value} to join this event.");
            if (e.MaxAge.HasValue && age > e.MaxAge.Value)
                throw new InvalidOperationException($"This event is open up to age {e.MaxAge.Value}.");
        }

        private async Task EnsureJoinAllowedAsync(Event e, int userId, bool checkCapacity)
        {
            if (e.OrganizerId == userId)
                return;
            var eventDateTime = e.Date.ToDateTime(e.Time);
            if (eventDateTime <= DateTime.Now)
                throw new InvalidOperationException("This event has already started.");
            if (checkCapacity && e.MaxAttendees > 0 && e.Participants.Count >= e.MaxAttendees)
                throw new InvalidOperationException("Event is full.");
            if (e.OrganizerId.HasValue && await _context.BlockedUsers.AnyAsync(block =>
                (block.BlockerUserId == userId && block.BlockedUserId == e.OrganizerId.Value) ||
                (block.BlockerUserId == e.OrganizerId.Value && block.BlockedUserId == userId)))
                throw new UnauthorizedAccessException("You cannot join this event.");
            await EnsureUserCanJoinByAgeAsync(e, userId);
        }

        private async Task EnsureOrganizerAsync(int eventId, int organizerId)
        {
            var ownerId = await _context.Events.Where(e => e.Id == eventId)
                .Select(e => e.OrganizerId).FirstOrDefaultAsync();
            if (!ownerId.HasValue)
                throw new KeyNotFoundException("Event does not exist.");
            if (ownerId.Value != organizerId)
                throw new UnauthorizedAccessException("Only the event organizer can review join requests.");
        }

        private async Task<GeocodingResult> ResolveLocationAsync(string? input)
        {
            var value = input?.Trim();
            if (string.IsNullOrWhiteSpace(value)) throw new InvalidOperationException("Event location is required.");
            return await _geocodingService.GeocodeAsync(value)
                ?? throw new InvalidOperationException("Choose a valid address from the location suggestions.");
        }

        private static DateTime ToEventDateTime(EventDto e)
        {
            return e.Date.ToDateTime(e.Time);
        }

        private async Task EnsureEventParticipantAsync(int eventId, int userId)
        {
            var eventExists = await _context.Events.AnyAsync(e => e.Id == eventId);
            if (!eventExists)
                throw new KeyNotFoundException("Event does not exist.");

            var isParticipant = await _context.EventParticipants
                .AnyAsync(p => p.EventId == eventId && p.UserId == userId);

            if (!isParticipant)
                throw new UnauthorizedAccessException("Join the event to open its discussion.");
        }

        private IQueryable<Event> GuestVisibleEvents(string city)
        {
            var cityVariants = GetCitySearchVariants(city);
            var localNow = DateTime.Now;
            var today = DateOnly.FromDateTime(localNow);
            var currentTime = TimeOnly.FromDateTime(localNow);

            return _context.Events
                .Include(e => e.Organizer)
                .Include(e => e.Interest)
                .Include(e => e.SavedByUsers)
                .Include(e => e.JoinRequests)
                .Include(e => e.Participants)
                    .ThenInclude(p => p.User)
                        .ThenInclude(u => u.Profile)
                .Where(e => e.Organizer != null &&
                    e.Organizer.Role == "Organizer" &&
                    e.LocationCity != null &&
                    cityVariants.Contains(e.LocationCity) &&
                    (e.Date > today || (e.Date == today && e.Time >= currentTime)));
        }

        private static List<string> GetCitySearchVariants(string city)
        {
            var value = city.Trim();
            var normalized = NormalizeCityName(value);
            var variants = new List<string> { value, normalized };
            if (string.Equals(normalized, "Niš", StringComparison.OrdinalIgnoreCase))
                variants.AddRange(new[] { "Niš", "Nis", "NiÅ¡" });

            return variants
                .Where(candidate => !string.IsNullOrWhiteSpace(candidate))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        private static string NormalizeCityName(string value)
        {
            return value
                .Replace("NiÅ¡", "Niš", StringComparison.OrdinalIgnoreCase)
                .Replace("Nis", "Niš", StringComparison.OrdinalIgnoreCase)
                .Replace("NISH", "Niš", StringComparison.OrdinalIgnoreCase);
        }

        private static EventDto ToDto(Event e, int currentUserId)
        {
            var participants = e.Participants
                .OrderBy(p => p.JoinedAt)
                .ToList();

            return new EventDto
            {
                Id = e.Id,
                Title = e.Title,
                Category = e.Interest?.Name,
                Date = e.Date,
                Time = e.Time,
                Location = GetPublicLocation(e),
                ShowFullAddress = e.ShowFullAddress,
                MaxAttendees = e.MaxAttendees,
                MinAge = e.MinAge,
                MaxAge = e.MaxAge,
                RequiresParticipantApproval = e.RequiresParticipantApproval,
                Description = e.Description,
                ImageUrl = e.ImageUrl,
                CreatedByUserId = e.OrganizerId,
                OrganizerUsername = e.Organizer?.Username,
                ParticipantsCount = participants.Count,
                ParticipantInitials = participants
                    .Take(4)
                    .Select(p => GetInitials(p.User?.Username))
                    .ToList(),
                ParticipantAvatars = participants
                    .Where(p => p.User != null)
                    .Take(4)
                    .Select(p => new EventParticipantAvatarDto
                    {
                        UserId = p.UserId,
                        Username = p.User!.Username,
                        Initials = GetInitials(p.User.Username),
                        ProfilePicture = p.User.Profile?.ProfilePicture
                    })
                    .ToList(),
                IsJoinedByCurrentUser = participants.Any(p => p.UserId == currentUserId),
                IsOrganizer = e.OrganizerId == currentUserId,
                IsCreator = e.OrganizerId == currentUserId,
                JoinRequestStatus = e.JoinRequests
                    .Where(request => request.UserId == currentUserId)
                    .Select(request => request.Status)
                    .FirstOrDefault(),
                PendingJoinRequestsCount = e.OrganizerId == currentUserId
                    ? e.JoinRequests.Count(request => request.Status == "Pending")
                    : 0,
                IsSaved = e.SavedByUsers.Any(saved => saved.UserId == currentUserId)
            };
        }


        private static string GetPublicLocation(Event e)
        {
            if (e.ShowFullAddress) return e.Location;
            var publicParts = new[] { e.LocationCity, e.LocationCountry }
                .Where(value => !string.IsNullOrWhiteSpace(value))
                .Select(value => value!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase);
            var publicLocation = string.Join(", ", publicParts);
            return string.IsNullOrWhiteSpace(publicLocation) ? "Location not shared" : publicLocation;
        }

        private static string GetInitials(string? username)
        {
            if (string.IsNullOrWhiteSpace(username))
                return "MY";

            var parts = username
                .Split(new[] { '.', '_', '-', ' ' }, StringSplitOptions.RemoveEmptyEntries)
                .Take(2)
                .Select(part => char.ToUpperInvariant(part[0]).ToString());

            var initials = string.Join("", parts);
            return string.IsNullOrWhiteSpace(initials) ? "MY" : initials;
        }

        private static int? CalculateAge(DateOnly? dob)
        {
            if (!dob.HasValue) return null;
            var today = DateOnly.FromDateTime(DateTime.Today);
            var age = today.Year - dob.Value.Year;
            if (dob.Value > today.AddYears(-age)) age--;
            return age;
        }

        private static EventDiscussionMessageDto ToDiscussionDto(EventDiscussionMessage message, int currentUserId)
        {
            var username = message.User?.Username;

            return new EventDiscussionMessageDto
            {
                Id = message.Id,
                EventId = message.EventId,
                UserId = message.UserId,
                Username = username,
                DisplayName = username,
                Initials = GetInitials(username),
                Avatar = message.User?.Profile?.ProfilePicture,
                Body = message.Body,
                CreatedAt = message.CreatedAt,
                UpdatedAt = message.UpdatedAt,
                IsMine = message.UserId == currentUserId,
                Attachment = MapAttachment(message.Attachment, message.EventId)
            };
        }

        private static MessageAttachmentDto? MapAttachment(MessageAttachment? attachment, int eventId) => attachment == null ? null : new MessageAttachmentDto
        {
            Id = attachment.Id, Kind = attachment.Kind, OriginalFileName = attachment.OriginalFileName,
            ContentType = attachment.ContentType, Size = attachment.Size,
            IsImage = attachment.ContentType?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true,
            DownloadUrl = attachment.Kind == "File" ? $"/api/Events/{eventId}/discussion/attachments/{attachment.Id}" : null,
            Provider = attachment.Provider, ProviderMediaId = attachment.ProviderMediaId,
            OriginalUrl = attachment.OriginalUrl, PreviewUrl = attachment.PreviewUrl
        };
    }
}
