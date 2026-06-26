import { MapPin, Clock, Pencil, UserPlus, Users } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import UserAvatar from './UserAvatar';
import EventSaveButton from './events/EventSaveButton';

function EventCard({
  event,
  style,
  mini = false,
  onJoin,
  onCancelJoinRequest,
  onOpen,
  onInvite,
  onEdit,
  onSavedChange,
}) {
  const { t } = useTranslation();
  const {
    title,
    category,
    date,
    time,
    location,
    description,
    ageLabel,
    attendees = [],
    attendeeCount = 0,
    isJoinedByCurrentUser = false,
    joinRequestStatus,
  } = event;
  const extra = Math.max(0, attendeeCount - attendees.length);

  if (mini) {
    return (
      <article
        className={`event-card event-card--mini${onOpen ? ' event-card--clickable' : ''}`}
        style={style}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        onClick={onOpen}
        onKeyDown={(eventKey) => {
          if (onOpen && (eventKey.key === 'Enter' || eventKey.key === ' ')) {
            eventKey.preventDefault();
            onOpen();
          }
        }}
      >
        <EventSaveButton
          eventId={event.id}
          isSaved={event.isSaved}
          onChange={onSavedChange}
          className='event-card__save'
        />
        <span className='event-card__category'>
          {t(`events.${category.toLowerCase()}`)}
        </span>
        <h4 className='event-card__title event-card__title--mini'>{title}</h4>
        <p className='event-card__meta-mini'>
          <Clock size={12} /> {date} · {time}
        </p>
      </article>
    );
  }

  return (
    <article
      className={`event-card${onOpen ? ' event-card--clickable' : ''}`}
      style={style}
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(eventKey) => {
        if (onOpen && (eventKey.key === 'Enter' || eventKey.key === ' ')) {
          eventKey.preventDefault();
          onOpen();
        }
      }}
    >
      <div className='event-card__top'>
        <span className='event-card__category'>
          {t(`events.${category.toLowerCase()}`)}
        </span>
        <span className='event-card__top-actions'>
          <EventSaveButton
            eventId={event.id}
            isSaved={event.isSaved}
            onChange={onSavedChange}
          />
          <span className='event-card__date-pill'>{date}</span>
        </span>
      </div>
      <h3 className='event-card__title'>{title}</h3>
      {description && <p className='event-card__desc'>{description}</p>}
      <p className='event-card__meta'>
        <MapPin size={14} />
        <span>{location}</span>
      </p>
      <p className='event-card__meta'>
        <Clock size={14} />
        <span>{time}</span>
      </p>
      {ageLabel && (
        <p className='event-card__meta'>
          <Users size={14} />
          <span>{ageLabel}</span>
        </p>
      )}
      <div className='event-card__footer'>
        <div className='event-card__attendees'>
          {attendees.map((attendee, i) => {
            const avatar =
              typeof attendee === 'string' ? { initials: attendee } : attendee;

            return (
              <UserAvatar
                key={avatar.userId || `${avatar.initials}-${i}`}
                className='event-card__attendee'
                style={{ zIndex: attendees.length - i }}
                profilePicture={avatar.profilePicture}
                initials={avatar.initials}
                alt={avatar.username || ''}
              />
            );
          })}
          {extra > 0 && (
            <span className='event-card__more'>
              {t('events.more', { count: extra })}
            </span>
          )}
        </div>
        <div className='event-card__actions'>
          {onEdit && (
            <button
              type='button'
              className='event-card__edit'
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onEdit();
              }}
            >
              <Pencil size={13} />
              {t('common.edit')}
            </button>
          )}
          {isJoinedByCurrentUser && onInvite && (
            <button
              type='button'
              className='event-card__invite'
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onInvite();
              }}
            >
              <UserPlus size={14} />
              {t('notifications.invite').toUpperCase()}
            </button>
          )}
          <button
            type='button'
            className={`event-card__join${isJoinedByCurrentUser ? ' event-card__join--joined' : ''}`}
            onClick={(clickEvent) => {
              clickEvent.stopPropagation();
              onJoin?.();
            }}
            disabled={isJoinedByCurrentUser || joinRequestStatus === 'Pending'}
          >
            {isJoinedByCurrentUser
              ? t('events.joined').toUpperCase()
              : joinRequestStatus === 'Pending'
                ? t('events.requestPending').toUpperCase()
                : t('events.join').toUpperCase()}
          </button>
          {joinRequestStatus === 'Pending' && onCancelJoinRequest && (
            <button
              type='button'
              className='event-card__cancel-request'
              onClick={(clickEvent) => {
                clickEvent.stopPropagation();
                onCancelJoinRequest();
              }}
            >
              {t('events.cancelRequest')}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export default EventCard;
