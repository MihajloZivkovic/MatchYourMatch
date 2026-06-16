import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import './CreateEvent.css';

const CATEGORIES = ['Study', 'Gaming', 'Coffee', 'Social', 'Sport'];

function CreateEvent() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('Study');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handlePublish = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = {
      title: form.get('title')?.toString().trim(),
      category,
      date: form.get('date')?.toString(),
      time: form.get('time')?.toString(),
      location: form.get('location')?.toString().trim(),
      maxAttendees: Number(form.get('maxAttendees') || 10),
      description: form.get('description')?.toString().trim(),
      imageUrl: null,
    };

    try {
      const response = await fetch('/api/Events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Event could not be created.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Event could not be created.');
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="page-fade-in create-event">
        <div className="create-event__card create-event__card--success">
          <CheckCircle size={56} className="create-event__check" />
          <h2>Event Created!</h2>
          <p>Your community event is now live.</p>
          <Link to="/app/events" className="app-btn-pill">
            VIEW EVENTS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in create-event">
      <form className="create-event__card" onSubmit={handlePublish}>
        <header className="create-event__header">
          <h1>CREATE EVENT</h1>
          <p>Bring MYM people together for a community meetup.</p>
        </header>

        {error && <div className="create-event__error">{error}</div>}

        <label className="create-event__field">
          <span>Event Title</span>
          <input type="text" name="title" required placeholder="Coffee & coding session" />
        </label>

        <fieldset className="create-event__field">
          <span>Category</span>
          <div className="create-event__pills">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`create-event__pill${category === cat ? ' create-event__pill--active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="create-event__row">
          <label className="create-event__field">
            <span>Date</span>
            <input type="date" name="date" required />
          </label>
          <label className="create-event__field">
            <span>Time</span>
            <input type="time" name="time" required />
          </label>
        </div>

        <label className="create-event__field">
          <span>Location</span>
          <input type="text" name="location" required placeholder="Nis, Serbia" />
        </label>

        <label className="create-event__field">
          <span>Max Attendees</span>
          <input type="number" name="maxAttendees" min="2" defaultValue="10" />
        </label>

        <label className="create-event__field">
          <span>Description</span>
          <textarea
            name="description"
            rows={4}
            required
            placeholder="What should people expect?"
          />
        </label>

        <div className="create-event__actions">
          <button type="button" className="create-event__cancel" onClick={() => navigate('/app/events')}>
            Cancel
          </button>
          <button type="submit" className="app-btn-pill" disabled={submitting}>
            {submitting ? 'PUBLISHING...' : 'PUBLISH EVENT'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateEvent;
