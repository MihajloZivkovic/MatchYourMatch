import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarX } from 'lucide-react';
import EventCard from '../../components/EventCard';
import './Events.css';

const FILTERS = ['ALL', 'NEARBY', 'THIS WEEK', 'STUDY', 'GAMING', 'COFFEE', 'SOCIAL', 'SPORT'];

function Events() {
  const [activeFilter, setActiveFilter] = useState('ALL');
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      setEvents(data.map(mapApiEvent));
    } catch (err) {
      setError(err.message || 'Events could not be loaded.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const filtered = useMemo(() => {
    if (activeFilter === 'ALL') return events;

    if (activeFilter === 'THIS WEEK') {
      const now = new Date();
      const weekFromNow = new Date(now);
      weekFromNow.setDate(now.getDate() + 7);

      return events.filter((event) => {
        const date = new Date(`${event.rawDate}T${event.rawTime || '00:00:00'}`);
        return date >= startOfDay(now) && date <= endOfDay(weekFromNow);
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

  return (
    <div className="page-fade-in events-page">
      <header className="events-page__header">
        <div>
          <h1>EVENTS</h1>
          <p>Community meetups created by MYM users.</p>
        </div>
        <Link to="/app/events/create" className="app-btn-pill events-page__create">
          + CREATE EVENT
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
            {f}
          </button>
        ))}
      </div>

      {loading && <div className="chat-state events-page__state">Loading events...</div>}

      {!loading && error && (
        <div className="chat-state chat-state--error events-page__state">
          <span>{error}</span>
          <button type="button" onClick={loadEvents}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 ? (
        <div className="app-empty events-page__empty">
          <CalendarX size={44} strokeWidth={1} className="app-empty__icon" />
          <p className="app-empty__title">
            {events.length === 0 ? 'No events yet' : 'No events found'}
          </p>
          <p className="app-empty__text">
            {events.length === 0
              ? 'Create the first community event.'
              : 'Try another filter or create something new.'}
          </p>
          <Link to="/app/events/create" className="app-btn-pill">
            Create One
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
            />
          ))}
        </div>
      )}
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
    description: event.description || 'Community event created by a MYM user.',
    attendees: event.participantInitials || [],
    attendeeCount: event.participantsCount || 0,
    maxAttendees: event.maxAttendees || 0,
    isJoinedByCurrentUser: Boolean(event.isJoinedByCurrentUser),
    organizerUsername: event.organizerUsername,
  };
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

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

export default Events;
