import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Search, Send, X } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import './EventInviteModal.css';

function EventInviteModal({ event, onClose }) {
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const { t } = useTranslation();

  const loadPeople = useCallback(async (signal) => {
    const url = `/api/Events/${event.id}/invite-candidates`;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        signal,
      });
      const body = await response.text();
      if (!response.ok) {
        console.error('Invite candidates request failed', { url, status: response.status, body });
        const requestError = new Error(response.status === 401 || response.status === 403
          ? t('notifications.loginAgain')
          : t('notifications.peopleError'));
        throw requestError;
      }
      setPeople(body ? JSON.parse(body) : []);
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message || t('notifications.peopleError'));
    } finally {
      setLoading(false);
    }
  }, [event.id, t]);

  useEffect(() => {
    const controller = new AbortController();
    const initial = window.setTimeout(() => loadPeople(controller.signal), 0);
    return () => { window.clearTimeout(initial); controller.abort(); };
  }, [loadPeople]);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people;
    return people.filter((person) =>
      person.username.toLowerCase().includes(normalized) ||
      person.displayName?.toLowerCase().includes(normalized));
  }, [people, query]);

  const sendInvite = async (person) => {
    setSendingId(person.id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(`/api/Events/${event.id}/invites`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteeUserId: person.id }),
      });
      const body = await response.text();
      if (!response.ok) {
        console.error('Event invite request failed', {
          url: `/api/Events/${event.id}/invites`,
          status: response.status,
          body,
        });
        throw new Error(t('notifications.inviteError'));
      }
      setPeople((current) => current.filter((item) => item.id !== person.id));
      setMessage(t('notifications.inviteSent', { username: person.username }));
    } catch (err) {
      setError(err.message || t('notifications.inviteError'));
    } finally {
      setSendingId(null);
    }
  };

  return (
    <div className="event-invite-modal" role="presentation" onMouseDown={onClose}>
      <section className="event-invite-modal__card" role="dialog" aria-modal="true"
        aria-labelledby="event-invite-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div><h2 id="event-invite-title">{t('notifications.invite')}</h2><p>{event.title}</p></div>
          <button type="button" onClick={onClose} aria-label={t('chatUi.close')}><X size={20} /></button>
        </header>
        <label className="event-invite-modal__search">
          <Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)}
            placeholder={t('notifications.searchPeople')} autoFocus />
        </label>
        {message && <p className="event-invite-modal__success">{message}</p>}
        {error && <p className="event-invite-modal__error">{error}</p>}
        <div className="event-invite-modal__list">
          {loading && <div className="event-invite-modal__state"><Loader2 className="event-invite-modal__spin" /><span>{t('notifications.loadingPeople')}</span></div>}
          {!loading && error && <div className="event-invite-modal__state"><button type="button" onClick={() => loadPeople()}>{t('common.retry')}</button></div>}
          {!loading && !error && filteredPeople.length === 0 && <div className="event-invite-modal__state">{t('notifications.noFollowedPeople')}</div>}
          {!loading && !error && filteredPeople.map((person) => (
            <div className="event-invite-modal__person" key={person.id}>
              <span className="event-invite-modal__avatar">
                {person.profilePicture ? <img src={person.profilePicture} alt="" /> : person.initials}
              </span>
              <span className="event-invite-modal__identity"><strong>{person.displayName}</strong><small>@{person.username}{person.locationDisplayName ? ` · ${person.locationDisplayName}` : ''}</small></span>
              <button type="button" disabled={sendingId === person.id}
                onClick={() => sendInvite(person)}>
                {sendingId === person.id ? <Loader2 size={15} className="event-invite-modal__spin" /> : <Send size={14} />}
                {t('notifications.sendInvite')}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default EventInviteModal;
