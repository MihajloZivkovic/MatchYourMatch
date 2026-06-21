import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { notificationService } from '../../services/notificationService';
import { useTranslation } from '../../hooks/useTranslation';
import UserAvatar from '../UserAvatar';
import './NotificationsDropdown.css';

function NotificationsDropdown({ mobile = false, onNavigate }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const loadCount = useCallback(async () => {
    try {
      const data = await notificationService.unreadCount();
      setUnread(data.count || 0);
    } catch { /* polling must stay quiet */ }
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await notificationService.list();
      setItems(Array.isArray(data) ? data : []);
      setUnread((Array.isArray(data) ? data : []).filter((item) => !item.isRead).length);
    } catch (err) {
      setError(err.status === 401 || err.status === 403
        ? t('notifications.loginAgain')
        : t('notifications.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const initial = window.setTimeout(loadCount, 0);
    const interval = window.setInterval(loadCount, 45000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [loadCount]);

  useEffect(() => {
    if (!open) return undefined;
    const initial = window.setTimeout(loadItems, 0);
    const close = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener('mousedown', close);
    };
  }, [loadItems, open]);

  const markRead = async (item) => {
    if (!item.isRead) {
      await notificationService.markRead(item.id);
      setItems((current) => current.map((value) => value.id === item.id ? { ...value, isRead: true } : value));
      setUnread((value) => Math.max(0, value - 1));
    }
  };

  const openItem = async (item) => {
    try { await markRead(item); } catch { /* navigation is still useful */ }
    setOpen(false);
    onNavigate?.();
    if (item.relatedEntityType === 'User' && (item.relatedEntityId || item.actorUserId)) {
      navigate(`/app/users/${item.relatedEntityId || item.actorUserId}`);
    } else if (item.relatedEntityType === 'Event') {
      navigate(`/app/events?event=${item.relatedEntityId}`);
    } else if (item.type === 'QuickMatch') {
      navigate('/app/chat');
    }
  };

  const markAll = async () => {
    setError('');
    try {
      await notificationService.markAllRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnread(0);
    } catch (err) {
      setError(err.status === 401 || err.status === 403
        ? t('notifications.loginAgain')
        : t('notifications.error'));
    }
  };

  const respond = async (event, item, action) => {
    event.stopPropagation();
    setError('');
    try {
      await notificationService.respondToInvite(item.eventInviteId, action);
      await markRead(item);
      setItems((current) => current.map((value) => value.id === item.id
        ? { ...value, eventInviteStatus: action === 'accept' ? 'Accepted' : 'Declined', isRead: true }
        : value));
    } catch (err) {
      setError(err.message || t('notifications.error'));
    }
  };

  return (
    <div className={`notifications${mobile ? ' notifications--mobile' : ''}`} ref={wrapRef}>
      <button type="button" className="notifications__bell" aria-label={t('notifications.title')}
        aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <Bell size={19} />
        {unread > 0 && <span className="notifications__badge">{unread > 99 ? '99+' : unread}</span>}
        {mobile && <span>{t('notifications.title')}</span>}
      </button>
      {open && (
        <div className="notifications__panel">
          <header className="notifications__header">
            <h3>{t('notifications.title')}</h3>
            {unread > 0 && <button type="button" onClick={markAll}><CheckCheck size={15} />{t('notifications.markAll')}</button>}
          </header>
          {loading && <div className="notifications__state"><Loader2 className="notifications__spin" size={20} /></div>}
          {!loading && error && (
            <div className="notifications__state notifications__state--error">
              <span>{error}</span>
              <button type="button" onClick={loadItems}>{t('common.retry')}</button>
            </div>
          )}
          {!loading && !error && items.length === 0 && <div className="notifications__state">{t('notifications.empty')}</div>}
          {!loading && items.length > 0 && (
            <div className="notifications__list">
              {items.map((item) => (
                <div key={item.id} role="button" tabIndex={0}
                  className={`notifications__item${item.isRead ? '' : ' notifications__item--unread'}`}
                  onClick={() => openItem(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') openItem(item);
                  }}>
                  <UserAvatar
                    className="notifications__avatar"
                    profilePicture={item.actorAvatar}
                    initials={(item.actorUsername || 'MY').slice(0, 2).toUpperCase()}
                    alt={item.actorUsername || ''}
                  />
                  <span className="notifications__body">
                    <strong>{item.title}</strong><span>{item.message}</span>
                    <small>{formatTime(item.createdAt)}</small>
                    {item.type === 'EventInvite' && item.eventInviteStatus === 'Pending' && item.eventInviteId && (
                      <span className="notifications__actions">
                        <button type="button" onClick={(event) => respond(event, item, 'accept')}>{t('notifications.accept')}</button>
                        <button type="button" onClick={(event) => respond(event, item, 'decline')}>{t('notifications.decline')}</button>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

export default NotificationsDropdown;
