import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarX } from 'lucide-react';
import EventCard from '../../components/EventCard';
import EventInviteModal from '../../components/events/EventInviteModal';
import './Events.css';
import { useTranslation } from '../../hooks/useTranslation';

const FILTERS = ['ALL', 'NEARBY', 'THIS WEEK', 'STUDY', 'GAMING', 'COFFEE', 'SOCIAL', 'SPORT'];

function Events({ currentUser }) {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [inviteEvent, setInviteEvent] = useState(null);
  const { t } = useTranslation();
  const filterLabels = { ALL: t('events.all'), NEARBY: t('events.nearby'), 'THIS WEEK': t('events.thisWeek'), STUDY: t('events.study'), GAMING: t('events.gaming'), COFFEE: t('events.coffee'), SOCIAL: t('events.social'), SPORT: t('events.sport') };

  const loadEvents = async () => {
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
  };

  useEffect(() => {
    const initial = window.setTimeout(loadEvents, 0);
    return () => window.clearTimeout(initial);
  }, []);

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

  const handleJoin = async (eventId) => {
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
    } catch (err) {
      setError(err.message || 'Event could not be joined.');
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
    } catch (err) {
      setError(err.message || t('events.cancelRequestError'));
    }
  };

  return (
    <div className="page-fade-in events-page">
      <header className="events-page__header">
        <div>
          <h1>{t('events.title').toUpperCase()}</h1>
          <p>{t('events.subtitle')}</p>
        </div>
        <Link to="/app/events/create" className="app-btn-pill events-page__create">
          + {t('nav.createEvent').toUpperCase()}
        </Link>
      </header>

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
            {events.length === 0 ? t('events.noUpcoming') : t('events.noFound')}
          </p>
          <p className="app-empty__text">
            {events.length === 0
              ? t('events.createInvite')
              : t('events.tryFilter')}
          </p>
          <Link to="/app/events/create" className="app-btn-pill">
            {t('events.createOne')}
          </Link>
        </div>
      ) : null}

      {!loading && !error && filtered.length > 0 && (
        <div className="events-page__grid">
          {filtered.map((event, i) => (
            <EventCard
              key={event.id}
              event={event}
              style={{ '--i': i }}
              onJoin={() => handleJoin(event.id)}
              onCancelJoinRequest={() => handleCancelJoinRequest(event.id)}
              onSavedChange={(isSaved) => setEvents((current) => current.map((value) =>
                value.id === event.id ? { ...value, isSaved } : value))}
              onInvite={() => setInviteEvent(event)}
              onEdit={Number(event.createdByUserId) === Number(currentUser?.id) ? () => navigate(`/app/events/${event.id}/edit`) : undefined}
            />
          ))}
        </div>
      )}
      {inviteEvent && <EventInviteModal event={inviteEvent} onClose={() => setInviteEvent(null)} />}
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
