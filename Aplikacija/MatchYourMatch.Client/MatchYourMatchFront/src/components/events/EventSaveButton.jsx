import { useEffect, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { savedEventService } from '../../services/savedEventService';
import { announceEventsChanged } from '../../services/notificationService';

function EventSaveButton({
  eventId,
  isSaved = false,
  onChange,
  className = '',
}) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState(Boolean(isSaved));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => setSaved(Boolean(isSaved)), [isSaved]);

  const toggle = async (clickEvent) => {
    clickEvent.stopPropagation();
    if (loading || !eventId) return;
    const next = !saved;
    setLoading(true);
    setError('');
    try {
      if (next) await savedEventService.save(eventId);
      else await savedEventService.remove(eventId);
      setSaved(next);
      onChange?.(next);
      announceEventsChanged({ source: 'event-save-button', eventId, isSaved: next });
    } catch {
      setError(t('events.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const title = saved ? t('events.removeSaved') : t('events.saveEvent');
  return (
    <span className={`event-save${className ? ` ${className}` : ''}`}>
      <button
        type='button'
        className={`event-save__button${saved ? ' event-save__button--saved' : ''}`}
        onClick={toggle}
        disabled={loading}
        aria-pressed={saved}
        aria-label={title}
        title={title}
      >
        <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
      </button>
      {error && (
        <span className='event-save__error' role='status'>
          {error}
        </span>
      )}
    </span>
  );
}

export default EventSaveButton;
