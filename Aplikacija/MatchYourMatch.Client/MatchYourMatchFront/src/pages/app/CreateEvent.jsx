import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import './CreateEvent.css';
import { useTranslation } from '../../hooks/useTranslation';

const CATEGORIES = ['Study', 'Gaming', 'Coffee', 'Social', 'Sport'];

function CreateEvent() {
  const navigate = useNavigate();
  const { t } = useTranslation();
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
          <h2>{t('events.created')}</h2>
          <p>{t('events.live')}</p>
          <Link to="/app/events" className="app-btn-pill">
            {t('events.viewEvents').toUpperCase()}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in create-event">
      <form className="create-event__card" onSubmit={handlePublish}>
        <header className="create-event__header">
          <h1>{t('events.createTitle').toUpperCase()}</h1>
          <p>{t('events.createSubtitle')}</p>
        </header>

        {error && <div className="create-event__error">{error}</div>}

        <label className="create-event__field">
          <span>{t('events.eventTitle')}</span>
          <input type="text" name="title" required placeholder={t('events.titlePlaceholder')} />
        </label>

        <fieldset className="create-event__field">
          <span>{t('events.category')}</span>
          <div className="create-event__pills">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`create-event__pill${category === cat ? ' create-event__pill--active' : ''}`}
                onClick={() => setCategory(cat)}
              >
                {t(`events.${cat.toLowerCase()}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="create-event__row">
          <label className="create-event__field">
            <span>{t('events.date')}</span>
            <input type="date" name="date" required />
          </label>
          <label className="create-event__field">
            <span>{t('events.time')}</span>
            <input type="time" name="time" required />
          </label>
        </div>

        <label className="create-event__field">
          <span>{t('events.location')}</span>
          <input type="text" name="location" required placeholder={t('events.locationPlaceholder')} />
        </label>

        <label className="create-event__field">
          <span>{t('events.maxAttendees')}</span>
          <input type="number" name="maxAttendees" min="2" defaultValue="10" />
        </label>

        <label className="create-event__field">
          <span>{t('events.description')}</span>
          <textarea
            name="description"
            rows={4}
            required
            placeholder={t('events.descriptionPlaceholder')}
          />
        </label>

        <div className="create-event__actions">
          <button type="button" className="create-event__cancel" onClick={() => navigate('/app/events')}>
            {t('common.cancel')}
          </button>
          <button type="submit" className="app-btn-pill" disabled={submitting}>
            {submitting ? t('events.publishing').toUpperCase() : t('events.publish').toUpperCase()}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CreateEvent;
