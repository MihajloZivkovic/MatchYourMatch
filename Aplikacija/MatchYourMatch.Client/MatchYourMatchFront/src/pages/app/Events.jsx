import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarX, ChevronLeft, ChevronRight } from 'lucide-react';
import EventCard from '../../components/EventCard';
import EventInviteModal from '../../components/events/EventInviteModal';
import GuestCityModal from '../../components/GuestCityModal';
import './Events.css';
import { useTranslation } from '../../hooks/useTranslation';
import { getGuestCity, isGuestSession, isOrganizerSession } from '../../services/guestSession';
import {
  announceEventsChanged,
  EVENTS_CHANGED_EVENT,
} from '../../services/notificationService';

const FILTERS = ['ALL', 'NEARBY', 'THIS WEEK', 'STUDY', 'GAMING', 'COFFEE', 'SOCIAL', 'SPORT'];
const EVENTS_PAGE_SIZE = 4;

function Events({ currentUser }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteEvent, setInviteEvent] = useState(null);
  const [guestCityModalOpen, setGuestCityModalOpen] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const { t } = useTranslation();
  const isGuest = isGuestSession();
  const isOrganizer = isOrganizerSession();
  const canCreateEvents = !isGuest && isOrganizer;
  const guestCity = getGuestCity();
  const filterLabels = { ALL: t('events.all'), NEARBY: t('events.nearby'), 'THIS WEEK': t('events.thisWeek'), STUDY: t('events.study'), GAMING: t('events.gaming'), COFFEE: t('events.coffee'), SOCIAL: t('events.social'), SPORT: t('events.sport') };

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/Events', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        throw new Error('Events could not be loaded.');
      }

      const data = await response.json();
      setEvents(data.map(mapApiEvent).filter(isUpcomingEvent));
    } catch (err) {
      setError(err.message || 'Events could not be loaded.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initial = window.setTimeout(loadEvents, 0);
    const refreshAfterExternalChange = (event) => {
      const source = event.detail?.source || '';
      if (source.startsWith('events-') || source === 'event-save-button')
        return;
      loadEvents();
    };
    window.addEventListener(EVENTS_CHANGED_EVENT, refreshAfterExternalChange);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener(EVENTS_CHANGED_EVENT, refreshAfterExternalChange);
    };
  }, [loadEvents]);

  useEffect(() => {
    const state = window.history.state?.usr;
    if (state?.guestBlocked) {
      setBlockedMessage(t('guest.accountRequired'));
      window.history.replaceState({ ...window.history.state, usr: {} }, '');
    } else if (state?.organizerOnly) {
      setBlockedMessage('Only organizers can create events.');
      window.history.replaceState({ ...window.history.state, usr: {} }, '');
    }
  }, [t]);

  const filtered = useMemo(() => {
    if (activeFilter === 'ALL') return events;

    if (activeFilter === 'THIS WEEK') {
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      return events.filter((event) => {
        const date = getEventDateTime(event);
        return date !== null && date >= now && date <= weekFromNow;
      });
    }

    if (activeFilter === 'NEARBY') {
      return events.filter((event) => /nis|niš|serbia|srbija/i.test(event.location));
    }

    return events.filter((event) => normalizeCategory(event.category) === activeFilter);
  }, [activeFilter, events]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / EVENTS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * EVENTS_PAGE_SIZE;
  const pagedEvents = filtered.slice(pageStart, pageStart + EVENTS_PAGE_SIZE);
  const showingFrom = filtered.length === 0 ? 0 : pageStart + 1;
  const showingTo = Math.min(pageStart + pagedEvents.length, filtered.length);

  useEffect(() => {
    setPage(1);
  }, [activeFilter]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const handleJoin = async (eventId) => {
    setNotice('');
    try {
      const response = await fetch(`/api/Events/${eventId}/join`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Event could not be joined.');
      }

      const updated = mapApiEvent(await response.json());
      setEvents((current) => current.map((event) => (event.id === eventId ? updated : event)));
      announceEventsChanged({ source: 'events-join', eventId });
    } catch (err) {
      setError(err.message || 'Event could not be joined.');
    }
  };

  const handleLeave = async (eventId) => {
    setNotice('');
    setError('');
    try {
      const response = await fetch(`/api/Events/${eventId}/join`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || t('events.leaveError'));
      }

      const updated = mapApiEvent(await response.json());
      setEvents((current) => current.map((event) => (event.id === eventId ? updated : event)));
      setNotice(t('events.left'));
      announceEventsChanged({ source: 'events-leave', eventId });
    } catch (err) {
      setError(err.message || t('events.leaveError'));
    }
  };

  const handleCancelJoinRequest = async (eventId) => {
    try {
      const response = await fetch(`/api/Events/${eventId}/join-request`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(await response.text() || t('events.cancelRequestError'));
      const updated = mapApiEvent(await response.json());
      setEvents((current) => current.map((event) => event.id === eventId ? updated : event));
      announceEventsChanged({ source: 'events-cancel-join-request', eventId });
    } catch (err) {
      setError(err.message || t('events.cancelRequestError'));
    }
  };

  return (
    <div className="page-fade-in events-page">
      <header className="events-page__header">
        <div>
          <h1>{t('events.title').toUpperCase()}</h1>
          <p>{isGuest ? t('guest.browsingCity', { city: guestCity }) : t('events.subtitle')}</p>
        </div>
        {isGuest ? (
          <button type="button" className="app-btn-pill events-page__create" onClick={() => setGuestCityModalOpen(true)}>
            {t('guest.changeCity')}
          </button>
        ) : canCreateEvents ? <Link to="/app/events/create" className="app-btn-pill events-page__create">
          + {t('nav.createEvent').toUpperCase()}
        </Link> : null}
      </header>

      {isGuest && (
        <div className="events-page__guest">
          <span>{t('guest.access')}</span>
          <p>{t('guest.onlyPublicOrganizerEvents')}</p>
        </div>
      )}

      {blockedMessage && (
        <div className="events-page__notice" role="status">
          {blockedMessage}
        </div>
      )}
      {notice && (
        <div className="events-page__notice" role="status">
          {notice}
        </div>
      )}

      <div className="events-page__filters">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={`events-page__filter${activeFilter === f ? ' events-page__filter--active' : ''}`}
            onClick={() => setActiveFilter(f)}
          >
            {filterLabels[f]}
          </button>
        ))}
      </div>

      {loading && <div className="chat-state events-page__state">{t('events.loading')}</div>}

      {!loading && error && (
        <div className="chat-state chat-state--error events-page__state">
          <span>{error}</span>
          <button type="button" onClick={loadEvents}>
            {t('common.retry')}
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 ? (
        <div className="app-empty events-page__empty">
          <CalendarX size={44} strokeWidth={1} className="app-empty__icon" />
          <p className="app-empty__title">
            {isGuest && events.length === 0 ? t('guest.noOrganizerEvents') : events.length === 0 ? t('events.noUpcoming') : t('events.noFound')}
          </p>
          <p className="app-empty__text">
            {isGuest
              ? t('guest.onlyPublicOrganizerEvents')
              : events.length === 0 && canCreateEvents
              ? t('events.createInvite')
              : t('events.tryFilter')}
          </p>
          {isGuest ? <button type="button" className="app-btn-pill" onClick={() => setGuestCityModalOpen(true)}>
            {t('guest.changeCity')}
          </button> : canCreateEvents ? <Link to="/app/events/create" className="app-btn-pill">
            {t('events.createOne')}
          </Link> : null}
        </div>
      ) : null}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="events-page__grid">
            {pagedEvents.map((event, i) => (
              <EventCard
                key={event.id}
                event={event}
                style={{ '--i': i }}
                guestMode={isGuest}
                organizerMode={isOrganizer}
                onJoin={() => handleJoin(event.id)}
                onLeave={() => handleLeave(event.id)}
                onCancelJoinRequest={() => handleCancelJoinRequest(event.id)}
                onSavedChange={(isSaved) => {
                  setEvents((current) => current.map((value) =>
                    value.id === event.id ? { ...value, isSaved } : value));
                }}
                onInvite={() => setInviteEvent(event)}
                onEdit={Number(event.createdByUserId) === Number(currentUser?.id) ? () => navigate(`/app/events/${event.id}/edit`) : undefined}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <nav className="events-page__pagination" aria-label={t('events.paginationAria')}>
              <p className="events-page__pagination-count">
                {t('events.paginationShowing', { first: showingFrom, last: showingTo, total: filtered.length })}
              </p>
              <div className="events-page__pagination-actions">
                <button
                  type="button"
                  className="events-page__page-btn"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage === 1}
                  aria-label={t('common.previous')}
                >
                  <ChevronLeft size={17} />
                </button>
                <span className="events-page__page-status">
                  {t('common.page')} {safePage} {t('common.of')} {totalPages}
                </span>
                <button
                  type="button"
                  className="events-page__page-btn"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage === totalPages}
                  aria-label={t('common.next')}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            </nav>
          )}
        </>
      )}
      {inviteEvent && <EventInviteModal event={inviteEvent} onClose={() => setInviteEvent(null)} />}
      {guestCityModalOpen && <GuestCityModal onClose={() => {
        setGuestCityModalOpen(false);
        loadEvents();
      }} />}
    </div>
  );
}

function mapApiEvent(event) {
  return {
    id: event.id,
    title: event.title,
    category: normalizeCategory(event.category),
    date: formatDate(event.date),
    rawDate: event.date,
    time: formatTime(event.time),
    rawTime: event.time,
    location: event.location || 'Community meetup',
    description: event.description || '',
    attendees: event.participantAvatars?.length
      ? event.participantAvatars
      : event.participantInitials || [],
    attendeeCount: event.participantsCount || 0,
    maxAttendees: event.maxAttendees || 0,
    minAge: event.minAge ?? null,
    maxAge: event.maxAge ?? null,
    ageLabel: formatAgeLimit(event.minAge, event.maxAge),
    isJoinedByCurrentUser: Boolean(event.isJoinedByCurrentUser),
    requiresParticipantApproval: Boolean(event.requiresParticipantApproval),
    joinRequestStatus: event.joinRequestStatus || null,
    pendingJoinRequestsCount: event.pendingJoinRequestsCount || 0,
    isSaved: Boolean(event.isSaved),
    organizerUsername: event.organizerUsername,
    createdByUserId: event.createdByUserId,
    isOrganizer: Boolean(event.isOrganizer),
    isCreator: Boolean(event.isCreator ?? event.isOrganizer),
  };
}

function formatAgeLimit(minAge, maxAge) {
  if (minAge != null && maxAge != null) return `Ages ${minAge}–${maxAge}`;
  if (minAge != null) return `${minAge}+`;
  if (maxAge != null) return `Up to ${maxAge}`;
  return '';
}

function normalizeCategory(category) {
  const value = (category || 'Social').trim().toUpperCase();
  if (value === 'SPORTS') return 'SPORT';
  if (value === 'TECH') return 'COFFEE';
  return value;
}

function formatDate(value) {
  if (!value) return 'Date TBA';
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString([], {
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

  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEventDateTime(event) {
  if (!event.rawDate) return null;

  const date = new Date(`${event.rawDate}T${event.rawTime || '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isUpcomingEvent(event) {
  const eventDateTime = getEventDateTime(event);
  return eventDateTime !== null && eventDateTime >= new Date();
}

export default Events;
