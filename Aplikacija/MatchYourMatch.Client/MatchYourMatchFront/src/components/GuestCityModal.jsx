import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { enterAsGuest, GUEST_FALLBACK_CITIES, normalizeCityName } from '../services/guestSession';

function GuestCityModal({ onClose }) {
  const [cities, setCities] = useState(GUEST_FALLBACK_CITIES);
  const [city, setCity] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    fetch('/api/Events/cities')
      .then((response) => response.ok ? response.json() : [])
      .then((data) => {
        if (!ignore && Array.isArray(data) && data.length > 0) {
          setCities([...new Set(data.map(normalizeCityName))]);
        }
      })
      .catch(() => {});
    return () => { ignore = true; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!city) {
      setError(t('guest.cityRequired'));
      return;
    }

    setLoading(true);
    setError('');
    try {
      await enterAsGuest(normalizeCityName(city));
      onClose?.();
      navigate('/app/events', { replace: true });
    } catch (err) {
      setError(err.message || t('guest.startError'));
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className="guest-modal" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !loading) onClose?.();
    }}>
      <section className="guest-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="guest-city-title">
        <button type="button" className="guest-modal__close" aria-label={t('common.cancel')} onClick={onClose} disabled={loading}>
          <X size={18} />
        </button>
        <h2 id="guest-city-title">{t('guest.chooseCity')}</h2>
        <p>{t('guest.citySubtitle')}</p>
        <form className="guest-modal__form" onSubmit={submit}>
          <label className="guest-modal__label" htmlFor="guest-city">
            {t('events.location')}
          </label>
          <select id="guest-city" className="guest-modal__select" value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">{t('guest.chooseCity')}</option>
            {cities.map((value) => <option key={value} value={normalizeCityName(value)}>{normalizeCityName(value)}</option>)}
          </select>
          {error && <p className="guest-modal__error" role="alert">{error}</p>}
          <div className="guest-modal__actions">
            <button type="button" className="btn btn--outline" onClick={onClose} disabled={loading}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="btn btn--primary" disabled={loading || !city}>
              {loading ? t('common.working') : t('guest.continue')}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body
  );
}

export default GuestCityModal;
