import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  announceEventJoinRequestChanged,
  announceNotificationsChanged,
  notificationService,
} from '../../services/notificationService';
import { useTranslation } from '../../hooks/useTranslation';
import UserAvatar from '../UserAvatar';
import './NotificationsDropdown.css';

function NotificationsDropdown({
  mobile = false,
  onNavigate,
  unread = 0,
  onUnreadChange,
  onRefreshUnread,
  organizerOnly = false,
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [respondingId, setRespondingId] = useState(null);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await notificationService.list();
      const nextItems = Array.isArray(data) ? data : [];
      setItems(organizerOnly ? nextItems.filter(isOrganizerNotification) : nextItems);
      onRefreshUnread?.();
    } catch (err) {
      setError(
        err.status === 401 || err.status === 403
          ? t('notifications.loginAgain')
          : t('notifications.error'),
      );
    } finally {
      setLoading(false);
    }
  }, [onRefreshUnread, organizerOnly, t]);

  useEffect(() => {
    if (!open) return undefined;
    const initial = window.setTimeout(loadItems, 0);
    const close = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target))
        setOpen(false);
    };
    const refresh = () => loadItems();
    document.addEventListener('mousedown', close);
    window.addEventListener('mym:event-join-request-changed', refresh);
    return () => {
      window.clearTimeout(initial);
      document.removeEventListener('mousedown', close);
      window.removeEventListener('mym:event-join-request-changed', refresh);
    };
  }, [loadItems, open]);

  const markRead = async (item) => {
    if (item.isRead) return;
    await notificationService.markRead(item.id);
    setItems((current) =>
      current.map((value) =>
        value.id === item.id ? { ...value, isRead: true } : value,
      ),
    );
    onUnreadChange?.((value) => Math.max(0, value - 1));
    announceNotificationsChanged();
  };

  const openActorProfile = async (event, item) => {
    event.stopPropagation();
    try {
      await markRead(item);
    } catch {
      /* navigation is still useful */
    }
    if (!item.actorUserId) return;
    setOpen(false);
    onNavigate?.();
    if (item.relatedEntityType === 'UserReport') {
      navigate('/admin/dashboard?section=reports');
      return;
    }
    navigate(`/app/users/${item.actorUserId}`);
  };

  const openItem = async (item) => {
    try {
      await markRead(item);
    } catch {
      /* navigation is still useful */
    }
    setOpen(false);
    onNavigate?.();
    if (
      (item.relatedEntityType === 'User' ||
        item.relatedEntityType === 'QuickMatchRequest') &&
      (item.relatedEntityId || item.actorUserId)
    ) {
      navigate(
        `/app/users/${item.relatedEntityType === 'QuickMatchRequest' ? item.actorUserId : item.relatedEntityId || item.actorUserId}`,
      );
    } else if (item.relatedEntityType === 'Event') {
      navigate(`/app/events?event=${item.relatedEntityId}`);
    } else if (item.relatedEntityType === 'UserReport') {
      navigate('/admin/dashboard?section=reports');
    } else if (item.type === 'QuickMatch') {
      navigate('/app/chat');
    }
  };

  const markAll = async () => {
    setError('');
    try {
      await notificationService.markAllRead();
      setItems((current) => current.map((item) => ({ ...item, isRead: true })));
      onUnreadChange?.(0);
      announceNotificationsChanged();
    } catch (err) {
      setError(
        err.status === 401 || err.status === 403
          ? t('notifications.loginAgain')
          : t('notifications.error'),
      );
    }
  };

  const respondInvite = async (event, item, action) => {
    event.stopPropagation();
    if (respondingId) return;
    setRespondingId(`invite-${item.eventInviteId}`);
    setError('');
    try {
      await notificationService.respondToInvite(item.eventInviteId, action);
      await markRead(item);
      setItems((current) =>
        current.map((value) =>
          value.id === item.id
            ? {
                ...value,
                eventInviteStatus:
                  action === 'accept' ? 'Accepted' : 'Declined',
                isRead: true,
              }
            : value,
        ),
      );
    } catch (err) {
      setError(err.message || t('notifications.error'));
      await loadItems();
    } finally {
      setRespondingId(null);
    }
  };

  const respondQuickMatch = async (event, item, action) => {
    event.stopPropagation();
    if (respondingId) return;
    setRespondingId(`quick-${item.quickMatchRequestId}`);
    setError('');
    try {
      const result = await notificationService.respondToQuickMatch(
        item.quickMatchRequestId,
        action,
      );
      await markRead(item);
      setItems((current) =>
        current.map((value) =>
          value.id === item.id
            ? { ...value, quickMatchRequestStatus: result.status, isRead: true }
            : value,
        ),
      );
    } catch (err) {
      setError(err.message || t('notifications.error'));
      await loadItems();
    } finally {
      setRespondingId(null);
    }
  };

  const respondEventJoinRequest = async (event, item, action) => {
    event.stopPropagation();
    if (respondingId) return;
    setRespondingId(`join-${item.eventJoinRequestId}`);
    setError('');
    try {
      const updatedEvent = await notificationService.respondToEventJoinRequest(
        item.eventJoinRequestEventId,
        item.eventJoinRequestId,
        action,
      );
      await markRead(item);
      const status = action === 'accept' ? 'Accepted' : 'Rejected';
      setItems((current) =>
        current.map((value) =>
          value.id === item.id
            ? { ...value, eventJoinRequestStatus: status, isRead: true }
            : value,
        ),
      );
      announceEventJoinRequestChanged({
        eventId: item.eventJoinRequestEventId,
        requestId: item.eventJoinRequestId,
        status,
        event: updatedEvent,
      });
    } catch (err) {
      setError(err.message || t('notifications.joinRequestActionError'));
      await loadItems();
      onRefreshUnread?.();
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div
      className={`notifications${mobile ? ' notifications--mobile' : ''}`}
      ref={wrapRef}
    >
      <button
        type='button'
        className='notifications__bell'
        aria-label={t('notifications.title')}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className='notifications__badge'>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
        {mobile && <span>{t('notifications.title')}</span>}
      </button>
      {open && (
        <div className='notifications__panel'>
          <header className='notifications__header'>
            <h3>{t('notifications.title')}</h3>
            {unread > 0 && (
              <button type='button' onClick={markAll}>
                <CheckCheck size={15} />
                {t('notifications.markAll')}
              </button>
            )}
          </header>
          {loading && (
            <div className='notifications__state'>
              <Loader2 className='notifications__spin' size={20} />
            </div>
          )}
          {!loading && error && (
            <div className='notifications__state notifications__state--error'>
              <span>{error}</span>
              <button type='button' onClick={loadItems}>
                {t('common.retry')}
              </button>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className='notifications__state'>
              {t('notifications.empty')}
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className='notifications__list'>
              {items.map((item) => {
                const joinBusy =
                  respondingId === `join-${item.eventJoinRequestId}`;
                const quickBusy =
                  respondingId === `quick-${item.quickMatchRequestId}`;
                const inviteBusy =
                  respondingId === `invite-${item.eventInviteId}`;
                return (
                  <div
                    key={item.id}
                    role='button'
                    tabIndex={0}
                    className={`notifications__item${item.isRead ? '' : ' notifications__item--unread'}`}
                    onClick={() => openItem(item)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ')
                        openItem(item);
                    }}
                  >
                    <button
                      type='button'
                      className='notifications__avatar-link'
                      aria-label={t('notifications.openProfile')}
                      onClick={(event) => openActorProfile(event, item)}
                    >
                      <UserAvatar
                        className='notifications__avatar'
                        profilePicture={item.actorAvatar}
                        initials={(item.actorUsername || 'MY')
                          .slice(0, 2)
                          .toUpperCase()}
                        alt={item.actorUsername || ''}
                      />
                    </button>
                    <span className='notifications__body'>
                      <strong>{item.title}</strong>
                      {item.type === 'EventJoinRequest' && item.actorUserId && (
                        <button
                          type='button'
                          className='notifications__actor'
                          onClick={(event) => openActorProfile(event, item)}
                        >
                          {item.actorDisplayName || item.actorUsername}
                        </button>
                      )}
                      <span>
                        {item.type === 'QuickMatchRequest'
                          ? `${item.actorDisplayName || item.actorUsername || ''} ${t('notifications.quickMatchWants')}`.trim()
                          : item.message}
                      </span>
                      <small>{formatTime(item.createdAt)}</small>
                      {item.type === 'EventInvite' &&
                        item.eventInviteStatus === 'Pending' &&
                        item.eventInviteId && (
                          <span className='notifications__actions'>
                            <button
                              type='button'
                              disabled={inviteBusy}
                              onClick={(event) =>
                                respondInvite(event, item, 'accept')
                              }
                            >
                              {t('notifications.accept')}
                            </button>
                            <button
                              type='button'
                              disabled={inviteBusy}
                              onClick={(event) =>
                                respondInvite(event, item, 'decline')
                              }
                            >
                              {t('notifications.decline')}
                            </button>
                          </span>
                        )}
                      {item.type === 'QuickMatchRequest' &&
                        item.quickMatchRequestStatus === 'Pending' &&
                        item.quickMatchRequestId && (
                          <span className='notifications__actions'>
                            <button
                              type='button'
                              disabled={quickBusy}
                              onClick={(event) =>
                                respondQuickMatch(event, item, 'accept')
                              }
                            >
                              {t('notifications.accept')}
                            </button>
                            <button
                              type='button'
                              disabled={quickBusy}
                              onClick={(event) =>
                                respondQuickMatch(event, item, 'decline')
                              }
                            >
                              {t('notifications.decline')}
                            </button>
                          </span>
                        )}
                      {item.type === 'QuickMatchRequest' &&
                        item.quickMatchRequestStatus &&
                        item.quickMatchRequestStatus !== 'Pending' && (
                          <small>
                            {item.quickMatchRequestStatus === 'Rejected'
                              ? t('notifications.declined')
                              : t(
                                  `notifications.${item.quickMatchRequestStatus.toLowerCase()}`,
                                )}
                          </small>
                        )}
                      {item.type === 'EventJoinRequest' &&
                        item.eventJoinRequestStatus === 'Pending' &&
                        item.eventJoinRequestId && (
                          <span className='notifications__actions'>
                            <button
                              type='button'
                              disabled={joinBusy}
                              onClick={(event) =>
                                respondEventJoinRequest(event, item, 'accept')
                              }
                            >
                              {joinBusy
                                ? t('common.loading')
                                : t('notifications.accept')}
                            </button>
                            <button
                              type='button'
                              disabled={joinBusy}
                              onClick={(event) =>
                                respondEventJoinRequest(event, item, 'decline')
                              }
                            >
                              {t('notifications.decline')}
                            </button>
                          </span>
                        )}
                      {item.type === 'EventJoinRequest' &&
                        item.eventJoinRequestStatus &&
                        item.eventJoinRequestStatus !== 'Pending' && (
                          <small
                            className={`notifications__decision notifications__decision--${item.eventJoinRequestStatus.toLowerCase()}`}
                          >
                            {item.eventJoinRequestStatus === 'Rejected'
                              ? t('notifications.declined')
                              : t('notifications.accepted')}
                          </small>
                        )}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

function isOrganizerNotification(item) {
  return [
    'EventJoinRequest',
    'EventParticipantJoined',
    'EventCapacityReached',
    'EventDiscussionReply',
    'EventUpdated',
    'EventCancelled',
  ].includes(item?.type);
}

export default NotificationsDropdown;
