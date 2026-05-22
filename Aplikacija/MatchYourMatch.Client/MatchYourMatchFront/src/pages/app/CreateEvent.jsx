import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle, Upload } from 'lucide-react';
import './CreateEvent.css';

const CATEGORIES = ['Music', 'Social', 'Sports', 'Art', 'Other'];

function CreateEvent() {
  const navigate = useNavigate();
  const [category, setCategory] = useState('Music');
  const [success, setSuccess] = useState(false);

  const handlePublish = (e) => {
    e.preventDefault();
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="page-fade-in create-event">
        <div className="create-event__card create-event__card--success">
          <CheckCircle size={56} className="create-event__check" />
          <h2>Event Created!</h2>
          <p>Your event is now live.</p>
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
          <p>Bring people together</p>
        </header>

        <label className="create-event__field">
          <span>Event Title</span>
          <input type="text" name="title" required placeholder="Give your event a name" />
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
          <input type="text" name="location" required placeholder="Venue or address" />
        </label>

        <label className="create-event__field">
          <span>Max Attendees</span>
          <input type="number" name="maxAttendees" min="2" defaultValue="20" />
        </label>

        <label className="create-event__field">
          <span>Description</span>
          <textarea name="description" rows={4} required placeholder="What should people expect?" />
        </label>

        <div className="create-event__upload">
          <Upload size={24} />
          <p>Drop image or click to upload</p>
          <input type="file" accept="image/*" aria-label="Cover image" />
        </div>

        <div className="create-event__actions">
          <button type="button" className="create-event__cancel" onClick={() => navigate('/app/events')}>
            Cancel
          </button>
          <button type="submit" className="app-btn-pill">
            PUBLISH EVENT
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateEvent;
