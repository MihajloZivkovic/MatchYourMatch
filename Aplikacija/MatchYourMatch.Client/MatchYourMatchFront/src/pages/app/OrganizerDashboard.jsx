import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CalendarClock,
  Check,
  Edit3,
  Eye,
  ImagePlus,
  Loader2,
  RefreshCw,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import UserAvatar from '../../components/UserAvatar';
import {
  announceEventsChanged,
  announceEventJoinRequestChanged,
  announceNotificationsChanged,
  announceProfileChanged,
  EVENTS_CHANGED_EVENT,
} from '../../services/notificationService';
import { organizerService } from '../../services/organizerService';
import { EventDetails } from './Profile';
import './OrganizerDashboard.css';

function OrganizerDashboard({ currentUser, userProfile }) {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionKey, setActionKey] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventTab, setEventTab] = useState('upcoming');
  const [eventPage, setEventPage] = useState(1);
  const [profileImageSaving, setProfileImageSaving] = useState(false);
  const fileInputRef = useRef(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const [profileData, eventBuckets] = await Promise.all([
        organizerService.profile(),
        organizerService.events(),
      ]);
      const ownedEvents = [
        ...(eventBuckets?.upcoming || []),
        ...(eventBuckets?.past || []),
        ...(eventBuckets?.saved || []),
      ]
        .filter((event) => event?.isOrganizer || event?.isCreator)
        .filter(uniqueById)
        .map(mapOrganizerEvent)
        .sort((a, b) => a.dateTime - b.dateTime);

      setProfile(profileData);
      setEvents(ownedEvents);
      await loadJoinRequests(ownedEvents);
    } catch (requestError) {
      setError(requestError.message || 'Organizer dashboard could not be loaded.');
      setEvents([]);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadJoinRequests = async (ownedEvents) => {
    const approvalEvents = ownedEvents.filter((event) => event.pendingJoinRequestsCount > 0);
    if (approvalEvents.length === 0) {
      setRequests([]);
      return;
    }

    setRequestsLoading(true);
    try {
      const response = await Promise.all(
        approvalEvents.map(async (event) => {
          const eventRequests = await organizerService.joinRequests(event.id);
          return eventRequests.map((request) => ({
            ...request,
            eventTitle: event.title,
          }));
        }),
      );
      setRequests(response.flat().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
    } catch {
      setRequests([]);
    } finally {
      setRequestsLoading(false);
    }
  };

  useEffect(() => {
    const initial = window.setTimeout(loadDashboard, 0);
    const refreshAfterExternalChange = (event) => {
      const source = event.detail?.source || '';
      if (source.startsWith('organizer-')) return;
      loadDashboard();
    };
    window.addEventListener(EVENTS_CHANGED_EVENT, refreshAfterExternalChange);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener(EVENTS_CHANGED_EVENT, refreshAfterExternalChange);
    };
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const now = Date.now();
    const upcoming = events.filter((event) => event.dateTime >= now);
    const past = events.filter((event) => event.dateTime < now);
    return [
      { label: 'Created events', value: events.length, icon: CalendarClock },
      { label: 'Upcoming', value: upcoming.length, icon: RefreshCw },
      { label: 'Past', value: past.length, icon: Check },
      { label: 'Attendees', value: events.reduce((sum, event) => sum + event.attendeeCount, 0), icon: Users },
      { label: 'Pending requests', value: requests.length, icon: UserCheck },
    ];
  }, [events, requests.length]);

  const upcomingEvents = useMemo(
    () => events.filter((event) => event.dateTime >= Date.now()),
    [events],
  );
  const pastEvents = useMemo(
    () => events.filter((event) => event.dateTime < Date.now()).sort((a, b) => b.dateTime - a.dateTime),
    [events],
  );
  const visibleEvents = eventTab === 'upcoming' ? upcomingEvents : pastEvents;
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(visibleEvents.length / pageSize));
  const pagedEvents = visibleEvents.slice((eventPage - 1) * pageSize, eventPage * pageSize);

  useEffect(() => {
    setEventPage(1);
  }, [eventTab]);

  useEffect(() => {
    if (eventPage > totalPages) setEventPage(totalPages);
  }, [eventPage, totalPages]);

  const handleRequest = async (request, action) => {
    const key = `${action}-${request.id}`;
    setActionKey(key);
    setError('');
    setNotice('');
    try {
      const updatedEvent = action === 'accept'
        ? await organizerService.acceptJoinRequest(request.eventId, request.id)
        : await organizerService.rejectJoinRequest(request.eventId, request.id);

      setRequests((current) => current.filter((item) => item.id !== request.id));
      setEvents((current) =>
        current.map((event) =>
          event.id === request.eventId ? mapOrganizerEvent(updatedEvent) : event,
        ),
      );
      setNotice(`${request.displayName || request.username} was ${action === 'accept' ? 'accepted' : 'rejected'}.`);
      announceEventJoinRequestChanged({ eventId: request.eventId, requestId: request.id, action });
      announceEventsChanged({ source: 'organizer-join-request', eventId: request.eventId });
    } catch (requestError) {
      setError(requestError.message || 'Join request could not be updated.');
    } finally {
      setActionKey('');
    }
  };

  const handleDelete = async (event) => {
    if (!window.confirm(`Delete "${event.title}"? This cannot be undone.`)) return;
    setActionKey(`delete-${event.id}`);
    setError('');
    setNotice('');
    try {
      await organizerService.deleteEvent(event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
      setRequests((current) => current.filter((item) => item.eventId !== event.id));
      setNotice('Event deleted.');
      announceNotificationsChanged();
      announceEventsChanged({ source: 'organizer-delete-event', eventId: event.id });
    } catch (requestError) {
      setError(requestError.message || 'Event could not be deleted.');
    } finally {
      setActionKey('');
    }
  };

  const handleProfileImageClick = () => {
    if (!profileImageSaving) fileInputRef.current?.click();
  };

  const handleProfileImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setNotice('');

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Please choose a JPG, PNG or WEBP image for the organization logo.');
      event.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Organization logo must be 5 MB or smaller.');
      event.target.value = '';
      return;
    }

    setProfileImageSaving(true);
    try {
      const saved = await organizerService.uploadProfileImage(file);
      const savedPicture = saved?.profilePicture || saved?.ProfilePicture;
      const cacheBustedPicture = savedPicture
        ? `${savedPicture}${savedPicture.includes('?') ? '&' : '?'}t=${Date.now()}`
        : null;
      setProfile((current) => ({
        ...(current || displayProfile),
        ...saved,
        profilePicture: cacheBustedPicture || savedPicture || current?.profilePicture || displayProfile?.profilePicture,
      }));
      announceProfileChanged({ source: 'organizer-profile-picture' });
      setNotice('Organization image updated.');
    } catch (requestError) {
      setError(requestError.message || 'Organization image could not be updated.');
    } finally {
      setProfileImageSaving(false);
      event.target.value = '';
    }
  };

  const displayProfile = profile || {
    username: currentUser?.username,
    email: currentUser?.email,
    profilePicture: userProfile?.profilePicture,
    location: userProfile?.location,
  };
  const organizationName = displayProfile?.fullName || displayProfile?.username || 'Organizer';
  const displayName = organizationName;
  const organizationType = displayProfile?.organizationType || displayProfile?.bio;

  const handleOpenEventDetails = (event) => {
    setSelectedEvent({
      id: event.id,
      title: event.title,
      category: event.category,
      date: event.rawDate || event.dateLabel,
      time: event.rawTime || event.timeLabel,
      location: event.location,
      description: event.description || '',
      attendeeCount: event.attendeeCount || 0,
      maxAttendees: event.maxAttendees || 0,
      ageLabel: event.ageLabel || '',
      isSaved: false,
      isJoinedByCurrentUser: true,
      joinRequestStatus: null,
      organizerUsername: displayProfile?.username || currentUser?.username,
      isOrganizer: true,
    });
  };

  const handleCloseEventDetails = () => setSelectedEvent(null);

  return (
    <div className="page-fade-in organizer-dashboard">
      <header className="organizer-dashboard__hero">
        <div>
          <span className="organizer-dashboard__eyebrow">Organizer dashboard</span>
          <h1>{displayName}</h1>
          <p>Manage your events, participant requests, and organization profile from one place.</p>
        </div>
        <div className="organizer-dashboard__hero-actions">
          <Link to="/app/events/create" className="app-btn-pill">
            Create event
          </Link>
          <Link to="/app/events" className="organizer-dashboard__ghost-btn">
            Browse events
          </Link>
        </div>
      </header>

      {error && (
        <div className="organizer-dashboard__alert organizer-dashboard__alert--error">
          <span>{error}</span>
          <button type="button" onClick={loadDashboard}>Retry</button>
        </div>
      )}
      {notice && <div className="organizer-dashboard__alert">{notice}</div>}

      {loading ? (
        <div className="chat-state organizer-dashboard__state">Loading organizer dashboard...</div>
      ) : (
        <>
          <section className="organizer-dashboard__stats" aria-label="Organizer overview">
            {stats.map(({ label, value, icon: Icon }) => (
              <article className="organizer-dashboard__stat" key={label}>
                <Icon size={18} />
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            ))}
          </section>

          <div className="organizer-dashboard__layout">
            <section className="organizer-dashboard__panel organizer-dashboard__panel--wide">
              <div className="organizer-dashboard__section-head">
                <div>
                  <h2>My events</h2>
                  <p>Owned events from your account.</p>
                </div>
                <Link to="/app/events/create" className="organizer-dashboard__icon-link">
                  Create
                </Link>
              </div>
              <div className="organizer-dashboard__tabs" role="tablist" aria-label="Organizer events">
                <button
                  type="button"
                  className={eventTab === 'upcoming' ? 'organizer-dashboard__tab organizer-dashboard__tab--active' : 'organizer-dashboard__tab'}
                  onClick={() => setEventTab('upcoming')}
                >
                  Upcoming <span>{upcomingEvents.length}</span>
                </button>
                <button
                  type="button"
                  className={eventTab === 'past' ? 'organizer-dashboard__tab organizer-dashboard__tab--active' : 'organizer-dashboard__tab'}
                  onClick={() => setEventTab('past')}
                >
                  Past <span>{pastEvents.length}</span>
                </button>
              </div>

              {selectedEvent ? (
                <EventDetails
                  event={selectedEvent}
                  onBack={handleCloseEventDetails}
                  onJoin={() => {}}
                  onCancelJoinRequest={() => {}}
                  onSavedChange={() => {}}
                  onEventUpdated={(updated) => setSelectedEvent(updated)}
                />
              ) : visibleEvents.length === 0 ? (
                <EmptyState
                  title={eventTab === 'upcoming' ? 'No upcoming organizer events' : 'No past organizer events'}
                  text={eventTab === 'upcoming'
                    ? 'Create your next event to start collecting attendees.'
                    : 'Past events you created will appear here.'}
                />
              ) : (
                <div className="organizer-dashboard__event-list">
                  {pagedEvents.map((event) => (
                    <article className="organizer-dashboard__event" key={event.id}>
                      <div>
                        <div className="organizer-dashboard__event-top">
                          <span>{event.category}</span>
                          <strong>{event.status}</strong>
                          {event.requiresParticipantApproval && <em>Approval required</em>}
                        </div>
                        <h3>{event.title}</h3>
                        <p>{event.dateLabel} at {event.timeLabel} · {event.location}</p>
                        <div className="organizer-dashboard__attendees">
                          <span>{event.attendeeCount}/{event.maxAttendees || 'Any'} attendees</span>
                          <div>
                            {event.attendees.slice(0, 4).map((attendee, index) => (
                              <UserAvatar
                                key={attendee.userId || `${attendee.initials}-${index}`}
                                className="organizer-dashboard__avatar"
                                profilePicture={attendee.profilePicture}
                                initials={attendee.initials}
                                alt={attendee.username || ''}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="organizer-dashboard__event-actions">
                        <button type="button" onClick={() => navigate(`/app/events/${event.id}/edit`)}>
                          <Edit3 size={14} /> Edit
                        </button>
                        <button type="button" onClick={() => handleOpenEventDetails(event)}>
                          <Eye size={14} /> Details
                        </button>
                        <button
                          type="button"
                          className="organizer-dashboard__danger"
                          disabled={actionKey === `delete-${event.id}`}
                          onClick={() => handleDelete(event)}
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </article>
                  ))}
                  {totalPages > 1 && (
                    <div className="organizer-dashboard__pagination">
                      <button
                        type="button"
                        disabled={eventPage === 1}
                        onClick={() => setEventPage((page) => Math.max(1, page - 1))}
                      >
                        Previous
                      </button>
                      <span>{eventPage} / {totalPages}</span>
                      <button
                        type="button"
                        disabled={eventPage === totalPages}
                        onClick={() => setEventPage((page) => Math.min(totalPages, page + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <aside className="organizer-dashboard__side">
              <section className="organizer-dashboard__panel">
                <div className="organizer-dashboard__section-head">
                  <div>
                    <h2>Profile</h2>
                    <p>Organization account preview.</p>
                  </div>
                </div>
                <div className="organizer-dashboard__profile">
                  <div className="organizer-dashboard__profile-media">
                    <button
                      type="button"
                      className="organizer-dashboard__profile-avatar-button"
                      onClick={handleProfileImageClick}
                      disabled={profileImageSaving}
                      aria-label="Change organization image"
                    >
                      <UserAvatar
                        className="organizer-dashboard__profile-avatar"
                        profilePicture={displayProfile?.profilePicture || userProfile?.profilePicture}
                        initials={getInitials(organizationName)}
                        alt={organizationName}
                      />
                      <span className="organizer-dashboard__profile-upload-indicator">
                        {profileImageSaving ? <Loader2 size={15} className="organizer-dashboard__spin" /> : <ImagePlus size={15} />}
                      </span>
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="organizer-dashboard__file-input"
                    onChange={handleProfileImageChange}
                  />
                  <div className="organizer-dashboard__profile-info">
                    <h3>{organizationName}</h3>
                    <p>@{displayProfile?.username || 'organizer'}</p>
                    {displayProfile?.email && <span>{displayProfile.email}</span>}
                    {organizationType && <span>{organizationType}</span>}
                  </div>
                </div>
              </section>

              <section className="organizer-dashboard__panel">
                <div className="organizer-dashboard__section-head">
                  <div>
                    <h2>Join requests</h2>
                    <p>Pending approvals across your events.</p>
                  </div>
                </div>
                {requestsLoading ? (
                  <p className="organizer-dashboard__muted">Loading requests...</p>
                ) : requests.length === 0 ? (
                  <EmptyState title="No pending requests" text="New requests will appear here when approval is enabled." compact />
                ) : (
                  <div className="organizer-dashboard__requests">
                    {requests.map((request) => (
                      <article className="organizer-dashboard__request" key={request.id}>
                        <UserAvatar
                          className="organizer-dashboard__request-avatar"
                          profilePicture={request.profilePicture}
                          initials={getInitials(request.username)}
                          alt={request.username}
                        />
                        <div>
                          <h3>{request.displayName || request.username}</h3>
                          <p>{request.eventTitle}</p>
                          <span>{formatDateTime(request.createdAt)}</span>
                        </div>
                        <div className="organizer-dashboard__request-actions">
                          <button
                            type="button"
                            disabled={actionKey === `accept-${request.id}`}
                            onClick={() => handleRequest(request, 'accept')}
                            aria-label={`Accept ${request.username}`}
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            disabled={actionKey === `reject-${request.id}`}
                            onClick={() => handleRequest(request, 'reject')}
                            aria-label={`Reject ${request.username}`}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState({ title, text, compact = false }) {
  return (
    <div className={`organizer-dashboard__empty${compact ? ' organizer-dashboard__empty--compact' : ''}`}>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function uniqueById(event, index, list) {
  return event?.id && list.findIndex((item) => item?.id === event.id) === index;
}

function mapOrganizerEvent(event) {
  const dateTime = getEventDateTime(event);
  const attendees = event.participantAvatars?.length
    ? event.participantAvatars
    : (event.participantInitials || []).map((initials) => ({ initials }));

  return {
    id: event.id,
    title: event.title || 'Untitled event',
    category: event.category || 'Social',
    location: event.location || 'Location not shared',
    dateTime,
    rawDate: event.date,
    rawTime: event.time,
    dateLabel: formatDate(event.date),
    timeLabel: formatTime(event.time),
    attendeeCount: event.participantsCount || 0,
    maxAttendees: event.maxAttendees || 0,
    pendingJoinRequestsCount: event.pendingJoinRequestsCount || 0,
    requiresParticipantApproval: Boolean(event.requiresParticipantApproval),
    status: dateTime < Date.now() ? 'Past' : 'Upcoming',
    attendees,
  };
}

function getEventDateTime(event) {
  const value = new Date(`${event.date}T${event.time || '00:00:00'}`).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function formatDate(value) {
  if (!value) return 'Date TBA';
  return new Date(`${value}T00:00:00`).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(value) {
  if (!value) return 'Time TBA';
  const [hours = '00', minutes = '00'] = value.split(':');
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(value) {
  if (!value) return 'Requested recently';
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(username = '') {
  const value = String(username).trim();
  if (!value) return 'MY';
  return value
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'MY';
}

export default OrganizerDashboard;
