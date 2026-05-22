import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarX } from 'lucide-react';
import EventCard from '../../components/EventCard';
import { events } from '../../data/events';
import './Events.css';

const FILTERS = ['ALL', 'NEARBY', 'THIS WEEK', 'MUSIC', 'SOCIAL', 'SPORTS', 'ART'];

function Events() {
  const [activeFilter, setActiveFilter] = useState('ALL');

  const filtered = useMemo(() => {
    if (activeFilter === 'ALL') return events;
    if (activeFilter === 'NEARBY') {
      return events.filter((e) => /Brooklyn|Manhattan|Williamsburg/i.test(e.location));
    }
    if (activeFilter === 'THIS WEEK') return events.filter((e) => e.date.includes('May'));
    return events.filter((e) => e.category === activeFilter);
  }, [activeFilter]);

  return (
    <div className="page-fade-in events-page">
      <header className="events-page__header">
        <h1>EVENTS</h1>
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

      {filtered.length === 0 ? (
        <div className="app-empty events-page__empty">
          <CalendarX size={44} strokeWidth={1} className="app-empty__icon" />
          <p className="app-empty__title">No events found</p>
          <p className="app-empty__text">Try another filter or create something new.</p>
          <Link to="/app/events/create" className="app-btn-pill">
            Create One
          </Link>
        </div>
      ) : (
        <div className="events-page__grid">
          {filtered.map((event, i) => (
            <EventCard key={event.id} event={event} style={{ '--i': i }} />
          ))}
        </div>
      )}
    </div>
  );
}

export default Events;
