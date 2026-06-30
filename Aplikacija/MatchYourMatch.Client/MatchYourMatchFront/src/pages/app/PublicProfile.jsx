import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bell,
  BellRing,
  CalendarDays,
  Check,
  Coffee,
  Compass,
  Heart,
  MapPin,
  MessageCircle,
  Moon,
  Music,
  Pencil,
  Sparkles,
  Star,
  UserPlus,
} from 'lucide-react';
import './PublicProfile.css';
import { useTranslation } from '../../hooks/useTranslation';
import UserAvatar from '../../components/UserAvatar';
import UserActionsMenu from '../../components/UserActionsMenu';
import ProfileStats from '../../components/profile/ProfileStats';
import FollowListModal from '../../components/profile/FollowListModal';
import EventCard from '../../components/EventCard';
import { getSessionRole, isGuestSession, isOrganizerSession } from '../../services/guestSession';
import './Profile.css';

function PublicProfile() {
  const { t } = useTranslation();
  const formatProfileValue = (value) => {
    const key = `profileValues.${value}`;
    const translated = t(key);
    if (translated !== key) return translated;
    const legacyKey = `profileOptions.${value}`;
    const legacy = t(legacyKey);
    return legacy === legacyKey ? value : legacy;
  };
  const { id } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followError, setFollowError] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [ratingStatus, setRatingStatus] = useState(null);
  const [ratingLoading, setRatingLoading] = useState(true);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const [ratingSuccess, setRatingSuccess] = useState('');
  const [selectedEventId, setSelectedEventId] = useState('');
  const [editingRatingId, setEditingRatingId] = useState(null);
  const [editingRatingValue, setEditingRatingValue] = useState(0);
  const [originalRatingValue, setOriginalRatingValue] = useState(0);
  const [followListType, setFollowListType] = useState(null);
  const [subscriptionEnabled, setSubscriptionEnabled] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [organizerEvents, setOrganizerEvents] = useState({
    upcoming: { items: [], page: 1, totalPages: 0 },
    past: { items: [], page: 1, totalPages: 0 },
  });
  const [organizerEventsLoading, setOrganizerEventsLoading] = useState(false);
  const [organizerEventsError, setOrganizerEventsError] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    async function loadProfile() {
      if (!id) {
        setError('Profile route is missing a user id.');
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('token');
      const requestUrl = `/api/UserProfile/public/${id}`;
      setLoading(true);
      setError('');

      try {
        console.log('[PublicProfile] request', requestUrl);

        const response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        console.log('[PublicProfile] status', response.status);

        if (response.status === 401 || response.status === 403) {
          setError('Please log in again.');
          return;
        }

        const body = await response.text();

        if (!response.ok) {
          console.error('[PublicProfile] failed', response.status, body);
          throw new Error(body || 'Profile could not be loaded.');
        }

        const data = body ? JSON.parse(body) : null;

        if (!data || !data.id || !data.username) {
          console.error('[PublicProfile] invalid response', data);
          throw new Error('Profile response was empty or invalid.');
        }

        setProfile(data);
        setIsFollowing(Boolean(data.isFollowing));
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('[PublicProfile] request error', err);
          setError(
            err.message ||
              'Profile could not be loaded. Make sure the backend is running.',
          );
        }
      } finally {
        setLoading(false);
      }
    }

    loadProfile();

    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadRating() {
      if (!id) return;
      if (!profile) return;
      if (isGuestSession()) {
        setRatingStatus(null);
        setRatingLoading(false);
        return;
      }
      setRatingLoading(true);
      setRatingError('');
      try {
        const response = await fetch(`/api/Users/${id}/rating-status`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('RATING_STATUS_FAILED');
        const data = await response.json();
        setRatingStatus(data);
        const unratedEvent = data.eligibleEvents?.find(
          (event) => event.myRating == null,
        );
        setSelectedEventId(
          unratedEvent?.eventId ? String(unratedEvent.eventId) : '',
        );
      } catch (err) {
        if (err.name !== 'AbortError') setRatingError(t('ratingErrors.load'));
      } finally {
        setRatingLoading(false);
      }
    }
    loadRating();
    return () => controller.abort();
  }, [id, profile?.role, t]);

  const handleFollow = async () => {
    if (followLoading) return;
    const previous = isFollowing;
    setIsFollowing(!previous);
    setFollowLoading(true);
    setFollowError('');
    setProfile((current) =>
      current
        ? {
            ...current,
            followersCount: Math.max(
              0,
              (current.followersCount || 0) + (previous ? -1 : 1),
            ),
          }
        : current,
    );
    try {
      const response = await fetch(`/api/Follow/${id}`, {
        method: previous ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok)
        throw new Error(
          (await response.text()) || t('publicProfile.followError'),
        );
    } catch (err) {
      setIsFollowing(previous);
      setProfile((current) =>
        current
          ? {
              ...current,
              followersCount: Math.max(
                0,
                (current.followersCount || 0) + (previous ? 1 : -1),
              ),
            }
          : current,
      );
      setFollowError(err.message || t('publicProfile.followError'));
    } finally {
      setFollowLoading(false);
    }
  };

  const saveRating = async (value) => {
    if (!ratingStatus?.canRate || ratingSaving) return;
    setRatingSaving(true);
    setRatingError('');
    setRatingSuccess('');
    try {
      const response = await fetch(`/api/Users/${id}/ratings`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId: selectedEventId ? Number(selectedEventId) : null,
          rating: value,
        }),
      });
      if (!response.ok) throw new Error('RATING_SAVE_FAILED');
      const updatedStatus = await response.json();
      setRatingStatus(updatedStatus);
      const nextUnratedEvent = updatedStatus.eligibleEvents?.find(
        (event) => event.myRating == null,
      );
      setSelectedEventId(
        nextUnratedEvent?.eventId ? String(nextUnratedEvent.eventId) : '',
      );
      setRatingSuccess(t('publicProfile.ratingSaved'));
    } catch {
      setRatingError(t('ratingErrors.save'));
    } finally {
      setRatingSaving(false);
    }
  };

  const beginRatingEdit = (rating) => {
    const value = Number(rating.rating);
    setEditingRatingId(rating.id);
    setEditingRatingValue(value);
    setOriginalRatingValue(value);
    setRatingError('');
    setRatingSuccess('');
  };

  const cancelRatingEdit = () => {
    setEditingRatingId(null);
    setEditingRatingValue(originalRatingValue);
    setRatingError('');
  };

  const updateRating = async () => {
    if (
      !editingRatingId ||
      ratingSaving ||
      editingRatingValue === originalRatingValue
    )
      return;
    setRatingSaving(true);
    setRatingError('');
    setRatingSuccess('');
    try {
      const response = await fetch(`/api/Users/${id}/rating`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ score: editingRatingValue }),
      });
      if (!response.ok)
        throw new Error((await response.text()) || 'RATING_UPDATE_FAILED');
      setRatingStatus(await response.json());
      setEditingRatingId(null);
      setRatingSuccess(t('publicProfile.ratingUpdated'));
    } catch {
      setRatingError(t('publicProfile.ratingUpdateError'));
    } finally {
      setRatingSaving(false);
    }
  };

  const initials = useMemo(
    () => getInitials(profile?.username || ''),
    [profile?.username],
  );
  const isOrganizerProfile = profile?.role?.toLowerCase() === 'organizer';
  const currentRole = getSessionRole();
  const isGuestViewer = currentRole.toLowerCase() === 'guest' || isGuestSession();
  const canUseDirectMessages =
    currentRole.toLowerCase() === 'user' && !isOrganizerSession() && !isOrganizerProfile;
  const canUseOrganizerActions =
    currentRole.toLowerCase() === 'user' && !isOrganizerSession();
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const selectedRatingEvent = ratingStatus?.eligibleEvents?.find(
    (event) => String(event.eventId) === selectedEventId,
  );
  const unratedEligibleEvents =
    ratingStatus?.eligibleEvents?.filter((event) => event.myRating == null) ||
    [];

  useEffect(() => {
    if (!isOrganizerProfile || !id) return undefined;
    const controller = new AbortController();

    const loadOrganizerExtras = async () => {
      setOrganizerEventsLoading(true);
      setOrganizerEventsError('');
      try {
        const [subscriptionResponse, upcomingResponse, pastResponse] =
          await Promise.all([
            fetch(`/api/organizers/${id}/subscription`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              signal: controller.signal,
            }),
            fetch(`/api/organizers/${id}/events?status=upcoming&page=1&pageSize=6`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              signal: controller.signal,
            }),
            fetch(`/api/organizers/${id}/events?status=past&page=1&pageSize=6`, {
              headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              signal: controller.signal,
            }),
          ]);

        if (subscriptionResponse.ok) {
          const data = await subscriptionResponse.json();
          setSubscriptionEnabled(Boolean(data.subscribed));
        }
        if (!upcomingResponse.ok || !pastResponse.ok)
          throw new Error('Organizer events could not be loaded.');

        setOrganizerEvents({
          upcoming: mapOrganizerEventPage(await upcomingResponse.json()),
          past: mapOrganizerEventPage(await pastResponse.json()),
        });
      } catch (err) {
        if (err.name !== 'AbortError')
          setOrganizerEventsError(err.message || 'Organizer events could not be loaded.');
      } finally {
        setOrganizerEventsLoading(false);
      }
    };

    loadOrganizerExtras();
    return () => controller.abort();
  }, [id, isOrganizerProfile]);

  const toggleSubscription = async () => {
    if (subscriptionLoading || !canUseOrganizerActions) return;
    const previous = subscriptionEnabled;
    setSubscriptionEnabled(!previous);
    setSubscriptionLoading(true);
    try {
      const response = await fetch(`/api/organizers/${id}/subscription`, {
        method: previous ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok)
        throw new Error((await response.text()) || 'Subscription could not be updated.');
      const data = await response.json();
      setSubscriptionEnabled(Boolean(data.subscribed));
    } catch (err) {
      setSubscriptionEnabled(previous);
      setFollowError(err.message || 'Subscription could not be updated.');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const loadOrganizerEventsPage = async (status, page) => {
    setOrganizerEventsLoading(true);
    setOrganizerEventsError('');
    try {
      const response = await fetch(`/api/organizers/${id}/events?status=${status}&page=${page}&pageSize=6`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(await response.text() || 'Organizer events could not be loaded.');
      const nextPage = mapOrganizerEventPage(await response.json());
      setOrganizerEvents((current) => ({
        ...current,
        [status]: nextPage,
      }));
    } catch (err) {
      setOrganizerEventsError(err.message || 'Organizer events could not be loaded.');
    } finally {
      setOrganizerEventsLoading(false);
    }
  };

  const handleOrganizerJoin = async (eventId) => {
    try {
      const response = await fetch(`/api/Events/${eventId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(await response.text() || 'Event could not be joined.');
      const updated = mapApiEvent(await response.json());
      replaceOrganizerEvent(updated);
    } catch (err) {
      setOrganizerEventsError(err.message || 'Event could not be joined.');
    }
  };

  const handleOrganizerLeave = async (eventId) => {
    try {
      const response = await fetch(`/api/Events/${eventId}/join`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(await response.text() || 'Event could not be left.');
      const updated = mapApiEvent(await response.json());
      replaceOrganizerEvent(updated);
    } catch (err) {
      setOrganizerEventsError(err.message || 'Event could not be left.');
    }
  };

  const handleCancelOrganizerRequest = async (eventId) => {
    try {
      const response = await fetch(`/api/Events/${eventId}/join-request`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error(await response.text() || 'Join request could not be canceled.');
      const updated = mapApiEvent(await response.json());
      replaceOrganizerEvent(updated);
    } catch (err) {
      setOrganizerEventsError(err.message || 'Join request could not be canceled.');
    }
  };

  const replaceOrganizerEvent = (updated) => {
    setOrganizerEvents((current) => ({
      upcoming: {
        ...current.upcoming,
        items: current.upcoming.items.map((event) => event.id === updated.id ? { ...event, ...updated } : event),
      },
      past: {
        ...current.past,
        items: current.past.items.map((event) => event.id === updated.id ? { ...event, ...updated } : event),
      },
    }));
  };

  if (loading) {
    return (
      <main className='public-profile'>
        <div className='public-profile__state'>
          {t('publicProfile.loading')}
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className='public-profile'>
        <button
          type='button'
          className='public-profile__back'
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className='public-profile__state public-profile__state--error'>
          {error}
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className='public-profile'>
        <button
          type='button'
          className='public-profile__back'
          onClick={() => navigate(-1)}
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className='public-profile__state public-profile__state--error'>
          Profile could not be loaded. Make sure the backend is running.
        </div>
      </main>
    );
  }

  if (isOrganizerProfile) {
    const organizerName = profile.organizationName || profile.fullName || profile.username;

    return (
      <main className='public-profile public-profile--organizer page-fade-in'>
        <button type='button' className='public-profile__back' onClick={() => navigate(-1)}>
          <ArrowLeft size={16} />
          Back
        </button>

        <header className='public-profile__hero public-profile__hero--organizer'>
          <div className='public-profile__mesh' aria-hidden='true' />
          <div className='public-profile__hero-inner'>
            <UserAvatar
              className='public-profile__avatar public-profile__avatar--organizer'
              profilePicture={profile.profilePicture}
              initials={getInitials(organizerName)}
              alt={`${organizerName} organizer profile`}
            />
            <div className='public-profile__identity'>
              <span className='public-profile__role-badge'>Organizer</span>
              <h1>{organizerName}</h1>
              <p>@{profile.username}</p>
              <span>
                <MapPin size={15} />
                {profile.locationDisplayName || 'Location not shared'}
              </span>
              <div className='public-profile__social-counts'>
                <button type='button' onClick={() => setFollowListType('followers')}>
                  <strong>{profile.followersCount || 0}</strong> followers
                </button>
              </div>
            </div>
            <div className='public-profile__actions'>
              <div className='public-profile__primary-actions'>
                {canUseOrganizerActions ? (
                  <>
                    <button
                      type='button'
                      className={`public-profile__follow${isFollowing ? ' public-profile__follow--active' : ''}`}
                      onClick={handleFollow}
                      disabled={followLoading || isBlocked}
                    >
                      {isFollowing ? <Check size={16} /> : <UserPlus size={16} />}
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                    <button
                      type='button'
                      className={`public-profile__bell${subscriptionEnabled ? ' public-profile__bell--active' : ''}`}
                      onClick={toggleSubscription}
                      disabled={subscriptionLoading}
                      title={subscriptionEnabled ? 'Notifications enabled for this organizer' : 'Notify me about new events'}
                    >
                      {subscriptionEnabled ? <BellRing size={16} /> : <Bell size={16} />}
                      {subscriptionEnabled ? 'Notifications on' : 'Notify me'}
                    </button>
                  </>
                ) : isGuestViewer ? (
                  <button
                    type='button'
                    className='public-profile__connect'
                    onClick={() => navigate('/login')}
                  >
                    Log in to follow
                  </button>
                ) : null}
              </div>
              {!isGuestViewer && (
                <UserActionsMenu
                  userId={profile.id}
                  username={profile.username}
                  context='profile'
                  onBlocked={() => setIsBlocked(true)}
                  onHidden={() => setIsHidden(true)}
                />
              )}
            </div>
            {followError && <p className='public-profile__action-error'>{followError}</p>}
          </div>
        </header>

        {(isBlocked || isHidden) && (
          <div className='public-profile__state'>
            {isBlocked
              ? 'You blocked this organizer.'
              : 'This organizer profile is hidden from your suggestions.'}
          </div>
        )}

        <section className='public-profile__grid public-profile__grid--organizer'>
          <article className='public-profile__card public-profile__card--wide'>
            <h2>
              <Heart size={17} />
              About organization
            </h2>
            <dl className='public-profile__org-details'>
              <div>
                <dt>Organization type</dt>
                <dd>{profile.organizationType || 'Organization'}</dd>
              </div>
              {profile.contactEmail && (
                <div>
                  <dt>Contact email</dt>
                  <dd>{profile.contactEmail}</dd>
                </div>
              )}
              <div>
                <dt>About organizer</dt>
                <dd>{profile.bio || 'This organizer has not added a description yet.'}</dd>
              </div>
            </dl>
          </article>

          <OrganizerRatingCard
            ratingStatus={ratingStatus}
            ratingLoading={ratingLoading}
            ratingSaving={ratingSaving}
            ratingError={ratingError}
            ratingSuccess={ratingSuccess}
            selectedRatingEvent={selectedRatingEvent}
            unratedEligibleEvents={unratedEligibleEvents}
            selectedEventId={selectedEventId}
            setSelectedEventId={setSelectedEventId}
            saveRating={saveRating}
            isGuestViewer={isGuestViewer}
            navigate={navigate}
          />

          <OrganizerEventSection
            title='Upcoming events'
            emptyMessage='No upcoming events from this organizer.'
            page={organizerEvents.upcoming}
            loading={organizerEventsLoading}
            error={organizerEventsError}
            guestMode={isGuestViewer}
            onPage={(page) => loadOrganizerEventsPage('upcoming', page)}
            onJoin={handleOrganizerJoin}
            onLeave={handleOrganizerLeave}
            onCancelJoinRequest={handleCancelOrganizerRequest}
            onSavedChange={(eventId, isSaved) => replaceOrganizerEvent({ id: eventId, isSaved })}
            onOpen={() => navigate('/app/events')}
          />

          <OrganizerEventSection
            title='Past events'
            emptyMessage='No past events from this organizer.'
            page={organizerEvents.past}
            loading={organizerEventsLoading}
            error=''
            guestMode={isGuestViewer}
            onPage={(page) => loadOrganizerEventsPage('past', page)}
            onJoin={handleOrganizerJoin}
            onLeave={handleOrganizerLeave}
            onCancelJoinRequest={handleCancelOrganizerRequest}
            onSavedChange={(eventId, isSaved) => replaceOrganizerEvent({ id: eventId, isSaved })}
            onOpen={() => navigate('/app/events')}
          />
        </section>
        {followListType && (
          <FollowListModal
            userId={profile.id}
            currentUserId={currentUserId}
            type={followListType}
            onClose={() => setFollowListType(null)}
          />
        )}
      </main>
    );
  }

  return (
    <main className='public-profile page-fade-in'>
      <button
        type='button'
        className='public-profile__back'
        onClick={() => navigate(-1)}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <header className='public-profile__hero'>
        <div className='public-profile__mesh' aria-hidden='true' />
        <div className='public-profile__hero-inner'>
          <UserAvatar
            className='public-profile__avatar'
            profilePicture={profile.profilePicture}
            initials={initials}
            alt={`${profile.username} profile`}
          />
          <div className='public-profile__identity'>
            <h1>{profile.fullName || profile.username}</h1>
            <p>@{profile.username}</p>
            <span>
              <MapPin size={15} />
              {profile.locationDisplayName || 'Location not shared'}
              {profile.age != null ? ` · ${profile.age}` : ''}
            </span>
            <div className='public-profile__social-counts'>
              <button
                type='button'
                onClick={() => setFollowListType('followers')}
              >
                <strong>{profile.followersCount || 0}</strong>{' '}
                {t('publicProfile.followers')}
              </button>
              <button
                type='button'
                onClick={() => setFollowListType('following')}
              >
                <strong>{profile.followingCount || 0}</strong>{' '}
                {t('publicProfile.followingCount')}
              </button>
            </div>
          </div>
          <div className='public-profile__actions'>
            <div className='public-profile__primary-actions'>
              <button
                type='button'
                className={`public-profile__follow${isFollowing ? ' public-profile__follow--active' : ''}`}
                onClick={handleFollow}
                disabled={followLoading || isBlocked}
                title={
                  isFollowing
                    ? t('publicProfile.unfollow')
                    : t('publicProfile.follow')
                }
              >
                {isFollowing ? <Check size={16} /> : <UserPlus size={16} />}
                {isFollowing
                  ? t('publicProfile.following')
                  : t('publicProfile.follow')}
              </button>
              {canUseDirectMessages && !isBlocked && profile.canMessage !== false && (
                <button
                  type='button'
                  className='public-profile__connect'
                  onClick={() =>
                    navigate(
                      `/app/chat?userId=${profile.id}&username=${encodeURIComponent(profile.username)}`,
                    )
                  }
                >
                  <MessageCircle size={16} />
                  {t('publicProfile.sayHello')}
                </button>
              )}
              {canUseDirectMessages && !isBlocked && profile.canMessage === false && (
                <span className='public-profile__connect-hint'>
                  {t('publicProfile.messageRestricted')}
                </span>
              )}
            </div>
            <UserActionsMenu
              userId={profile.id}
              username={profile.username}
              context='profile'
              onBlocked={() => setIsBlocked(true)}
              onHidden={() => setIsHidden(true)}
            />
          </div>
          {followError && (
            <p className='public-profile__action-error'>{followError}</p>
          )}
        </div>
      </header>

      {(isBlocked || isHidden) && (
        <div className='public-profile__state'>
          {isBlocked
            ? 'You blocked this user.'
            : 'This profile is hidden from your suggestions.'}
        </div>
      )}

      <ProfileStats
        matches={profile.matchesCount}
        eventsJoined={profile.eventsJoinedCount}
        profileScore={profile.profileScorePercent}
        responseRate={profile.responseRatePercent}
        ratingsCount={profile.ratingsCount || 0}
        labels={{
          matches: t('profile.matches'),
          eventsJoined: t('profile.eventsJoined'),
          profileScore: t('profile.score'),
          responseRate: t('profile.responseRate'),
        }}
      />

      <section className='public-profile__grid'>
        <article className='public-profile__card public-profile__card--wide'>
          <h2>
            <Heart size={17} />
            About
          </h2>
          <p>{profile.bio || 'This user has not added a bio yet.'}</p>
        </article>

        {profile.littleThings?.length > 0 && (
          <article className='public-profile__card public-profile__card--wide'>
            <h2>
              <Sparkles size={17} />
              {t('profile.littleThings')}
            </h2>
            <div className='public-profile__pills'>
              {profile.littleThings.map((tag) => (
                <span key={tag}>{formatProfileValue(tag)}</span>
              ))}
            </div>
          </article>
        )}

        {!isBlocked && (
          <article className='public-profile__card public-profile__card--wide public-profile__rating-card'>
            <div className='public-profile__rating-head'>
              <h2>
                <Star size={17} />
                {t('publicProfile.rateUser')}
              </h2>
              <div>
                <strong>
                  {ratingStatus?.averageRating != null
                    ? Number(ratingStatus.averageRating).toFixed(1)
                    : '—'}{' '}
                  / 5
                </strong>
                <span>
                  {ratingStatus?.ratingsCount || 0} {t('publicProfile.ratings')}
                </span>
              </div>
            </div>

            {ratingLoading && <p>{t('common.loading')}</p>}
            {!ratingLoading && ratingStatus && (
              <>
                <RatingStars
                  value={Number(ratingStatus.averageRating || 0)}
                  label={t('publicProfile.averageRating')}
                />
                {ratingStatus.myRatings?.length > 0 && (
                  <div className='public-profile__my-ratings'>
                    <strong>
                      {ratingStatus.myRatings.length === 1
                        ? `${t('publicProfile.yourRating')}: ${Number(ratingStatus.myRatings[0].rating).toFixed(1)} / 5`
                        : t('publicProfile.yourRatings')}
                    </strong>
                    {ratingStatus.myRatings.map((rating) => (
                      <div
                        className='public-profile__my-rating'
                        key={rating.id}
                      >
                        <div className='public-profile__my-rating-info'>
                          <span>
                            {rating.encounterTitle || rating.encounterType}
                          </span>
                          <small>{formatRatingMeta(rating)}</small>
                        </div>
                        {editingRatingId === rating.id ? (
                          <div className='public-profile__rating-edit-form'>
                            <RatingStars
                              value={editingRatingValue}
                              interactive
                              disabled={ratingSaving}
                              label={t('publicProfile.yourRating')}
                              onChange={setEditingRatingValue}
                            />
                            <div>
                              <button
                                type='button'
                                className='public-profile__rating-save'
                                onClick={updateRating}
                                disabled={
                                  ratingSaving ||
                                  editingRatingValue === originalRatingValue
                                }
                              >
                                {t('publicProfile.saveChanges')}
                              </button>
                              <button
                                type='button'
                                className='public-profile__rating-cancel'
                                onClick={cancelRatingEdit}
                                disabled={ratingSaving}
                              >
                                {t('common.cancel')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type='button'
                            className='public-profile__rating-edit'
                            onClick={() => beginRatingEdit(rating)}
                            disabled={ratingSaving || editingRatingId != null}
                          >
                            <Pencil size={13} />
                            {t('publicProfile.editRating')}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {ratingStatus.canRate ? (
                  <div className='public-profile__rating-editor'>
                    {unratedEligibleEvents.length > 1 && (
                      <label>
                        <span>{t('publicProfile.chooseEvent')}</span>
                        <select
                          value={selectedEventId}
                          onChange={(event) =>
                            setSelectedEventId(event.target.value)
                          }
                        >
                          {unratedEligibleEvents.map((event) => (
                            <option key={event.eventId} value={event.eventId}>
                              {event.title} —{' '}
                              {formatRatingEventDate(event.dateTime)}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {selectedRatingEvent &&
                      unratedEligibleEvents.length === 1 && (
                        <p className='public-profile__rating-event'>
                          {t('publicProfile.basedOn')}{' '}
                          <strong>{selectedRatingEvent.title}</strong>
                        </p>
                      )}
                    <span className='public-profile__rating-label'>
                      {t('publicProfile.yourRating')}
                    </span>
                    <div className='public-profile__rating-input'>
                      <RatingStars
                        value={Number(
                          selectedRatingEvent?.myRating ??
                            ratingStatus.myRating ??
                            0,
                        )}
                        interactive
                        disabled={ratingSaving}
                        label={t('publicProfile.yourRating')}
                        onChange={saveRating}
                      />
                      <button
                        type='button'
                        disabled={ratingSaving}
                        onClick={() => saveRating(0)}
                      >
                        0
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className='public-profile__rating-hint'>
                    {ratingStatus.reason || t('publicProfile.ratingHint')}
                  </p>
                )}
              </>
            )}
            {ratingError && (
              <p className='public-profile__rating-error'>{ratingError}</p>
            )}
            {ratingSuccess && (
              <p className='public-profile__rating-success'>{ratingSuccess}</p>
            )}
          </article>
        )}

        {profile.currentlyExploring?.length > 0 && (
          <article className='public-profile__card'>
            <h2>
              <Compass size={17} />
              {t('profile.exploring')}
            </h2>
            <div className='public-profile__pills'>
              {profile.currentlyExploring.map((tag) => (
                <span key={tag}>{formatProfileValue(tag)}</span>
              ))}
            </div>
          </article>
        )}

        <section
          className='public-profile__lifestyle public-profile__card--wide'
          aria-labelledby='public-profile-lifestyle-title'
        >
          <h2 id='public-profile-lifestyle-title'>
            {t('profileLifestyle.title')}
          </h2>
          <div className='public-profile__lifestyle-grid'>
            <article className='public-profile__lifestyle-card'>
              <h3>
                <Music size={14} />
                {t('profile.favoriteActivities')}
              </h3>
              {profile.favoriteActivities?.length > 0 ? (
                <div className='public-profile__pills'>
                  {profile.favoriteActivities.map((tag) => (
                    <span key={tag}>{formatProfileValue(tag)}</span>
                  ))}
                </div>
              ) : (
                <p>{t('profileLifestyle.noActivities')}</p>
              )}
            </article>
            <article className='public-profile__lifestyle-card'>
              <h3>{t('profile.socialEnergy')}</h3>
              {profile.socialEnergy != null ? (
                <div className='public-profile__energy'>
                  <div className='public-profile__energy-ring'>
                    <svg viewBox='0 0 36 36' aria-hidden='true'>
                      <circle
                        cx='18'
                        cy='18'
                        r='15'
                        className='public-profile__ring-bg'
                      />
                      <circle
                        cx='18'
                        cy='18'
                        r='15'
                        className='public-profile__ring-fill'
                        style={{
                          strokeDashoffset:
                            94 * (1 - profile.socialEnergy / 100),
                        }}
                      />
                    </svg>
                    <span>{profile.socialEnergy}%</span>
                  </div>
                  <p>
                    {profile.socialEnergy <= 30
                      ? t('profileLifestyle.lowKey')
                      : profile.socialEnergy <= 70
                        ? t('profileLifestyle.balanced')
                        : t('profileLifestyle.verySocial')}
                  </p>
                </div>
              ) : (
                <p>{t('profileLifestyle.notSet')}</p>
              )}
            </article>
            <article className='public-profile__lifestyle-card'>
              <h3>
                <Coffee size={14} />
                {t('profile.conversationStyle')}
              </h3>
              <p>
                {profile.conversationStyle
                  ? formatProfileValue(profile.conversationStyle)
                  : t('profileLifestyle.notSet')}
              </p>
            </article>
            <article className='public-profile__lifestyle-card'>
              <h3>
                <Moon size={14} />
                {t('profile.lookingFor')}
              </h3>
              {profile.lookingFor?.length > 0 ? (
                <div className='public-profile__pills'>
                  {profile.lookingFor.map((tag) => (
                    <span key={tag}>{formatProfileValue(tag)}</span>
                  ))}
                </div>
              ) : (
                <p>{t('profileLifestyle.notSet')}</p>
              )}
            </article>
          </div>
        </section>

        <article className='public-profile__card'>
          <h2>
            <Sparkles size={17} />
            Interests
          </h2>
          {profile.interests?.length > 0 ? (
            <div className='public-profile__pills'>
              {profile.interests.map((interest) => (
                <span key={interest.id}>{interest.name}</span>
              ))}
            </div>
          ) : (
            <p>{t('publicProfile.noInterests')}</p>
          )}
        </article>
      </section>
      {followListType && (
        <FollowListModal
          userId={profile.id}
          currentUserId={currentUserId}
          type={followListType}
          onClose={() => setFollowListType(null)}
        />
      )}
    </main>
  );
}

function OrganizerEventSection({
  title,
  emptyMessage,
  page,
  loading,
  error,
  guestMode = false,
  onPage,
  onJoin,
  onLeave,
  onCancelJoinRequest,
  onSavedChange,
  onOpen,
}) {
  return (
    <article className='public-profile__card public-profile__card--wide public-profile__organizer-events'>
      <div className='public-profile__organizer-events-head'>
        <h2>
          <CalendarDays size={17} />
          {title}
        </h2>
        {page.totalPages > 1 && (
          <span>
            Page {page.page} of {page.totalPages}
          </span>
        )}
      </div>
      {loading && <p className='public-profile__events-state'>Loading events...</p>}
      {error && <p className='public-profile__events-state public-profile__events-state--error'>{error}</p>}
      {!loading && !error && page.items.length === 0 && (
        <p className='public-profile__events-state'>{emptyMessage || 'No events here yet.'}</p>
      )}
      {!loading && !error && page.items.length > 0 && (
        <div className='public-profile__organizer-event-grid'>
          {page.items.map((event, index) => (
            <EventCard
              key={event.id}
              event={event}
              style={{ '--i': index }}
              guestMode={guestMode}
              onJoin={() => onJoin(event.id)}
              onLeave={() => onLeave(event.id)}
              onCancelJoinRequest={() => onCancelJoinRequest(event.id)}
              onSavedChange={(isSaved) => onSavedChange(event.id, isSaved)}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
      {page.totalPages > 1 && (
        <div className='public-profile__pager'>
          <button type='button' disabled={page.page <= 1 || loading} onClick={() => onPage(page.page - 1)}>
            Previous
          </button>
          <button type='button' disabled={page.page >= page.totalPages || loading} onClick={() => onPage(page.page + 1)}>
            Next
          </button>
        </div>
      )}
    </article>
  );
}

function OrganizerRatingCard({
  ratingStatus,
  ratingLoading,
  ratingSaving,
  ratingError,
  ratingSuccess,
  selectedRatingEvent,
  unratedEligibleEvents,
  selectedEventId,
  setSelectedEventId,
  saveRating,
  isGuestViewer,
  navigate,
}) {
  return (
    <article className='public-profile__card public-profile__card--wide public-profile__rating-card'>
      <div className='public-profile__rating-head'>
        <h2>
          <Star size={17} />
          Organizer rating
        </h2>
        <div>
          <strong>
            {ratingStatus?.averageRating != null
              ? Number(ratingStatus.averageRating).toFixed(1)
              : '-'}{' '}
            / 5
          </strong>
          <span>{ratingStatus?.ratingsCount || 0} ratings</span>
        </div>
      </div>

      {isGuestViewer ? (
        <div className='public-profile__rating-guest'>
          <p>Log in or register to rate this organizer.</p>
          <button type='button' onClick={() => navigate('/login')}>
            Log in
          </button>
        </div>
      ) : (
        <>
          {ratingLoading && <p>Loading organizer rating...</p>}
          {!ratingLoading && ratingStatus && (
            <>
              <RatingStars
                value={Number(ratingStatus.averageRating || 0)}
                label='Organizer rating'
              />
              {ratingStatus.canRate ? (
                <div className='public-profile__rating-editor'>
                  {unratedEligibleEvents.length > 1 && (
                    <label>
                      <span>Choose event</span>
                      <select
                        value={selectedEventId}
                        onChange={(event) => setSelectedEventId(event.target.value)}
                      >
                        {unratedEligibleEvents.map((event) => (
                          <option key={event.eventId} value={event.eventId}>
                            {event.title} - {formatRatingEventDate(event.dateTime)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  {selectedRatingEvent && unratedEligibleEvents.length === 1 && (
                    <p className='public-profile__rating-event'>
                      Based on <strong>{selectedRatingEvent.title}</strong>
                    </p>
                  )}
                  <span className='public-profile__rating-label'>Rate this organizer</span>
                  <div className='public-profile__rating-input'>
                    <RatingStars
                      value={Number(selectedRatingEvent?.myRating ?? ratingStatus.myRating ?? 0)}
                      interactive
                      disabled={ratingSaving}
                      label='Rate this organizer'
                      onChange={saveRating}
                    />
                    <button type='button' disabled={ratingSaving} onClick={() => saveRating(0)}>
                      0
                    </button>
                  </div>
                </div>
              ) : (
                <p className='public-profile__rating-hint'>
                  You can rate this organizer after attending one of their events.
                </p>
              )}
            </>
          )}
        </>
      )}
      {ratingError && <p className='public-profile__rating-error'>{ratingError}</p>}
      {ratingSuccess && <p className='public-profile__rating-success'>{ratingSuccess}</p>}
    </article>
  );
}

function RatingStars({
  value,
  interactive = false,
  disabled = false,
  onChange,
  label,
}) {
  const [preview, setPreview] = useState(null);
  const displayed = preview ?? value;

  return (
    <div
      className={`public-profile__stars${interactive ? ' public-profile__stars--interactive' : ''}`}
      aria-label={`${label}: ${displayed} / 5`}
      onMouseLeave={() => setPreview(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const fill = Math.max(0, Math.min(1, displayed - (star - 1))) * 100;
        return (
          <span className='public-profile__star' key={star}>
            <span className='public-profile__star-base'>★</span>
            <span
              className='public-profile__star-fill'
              style={{ width: `${fill}%` }}
            >
              ★
            </span>
            {interactive && (
              <>
                <button
                  type='button'
                  disabled={disabled}
                  aria-label={`${star - 0.5} / 5`}
                  onMouseEnter={() => setPreview(star - 0.5)}
                  onFocus={() => setPreview(star - 0.5)}
                  onClick={() => onChange?.(star - 0.5)}
                />
                <button
                  type='button'
                  disabled={disabled}
                  aria-label={`${star} / 5`}
                  onMouseEnter={() => setPreview(star)}
                  onFocus={() => setPreview(star)}
                  onClick={() => onChange?.(star)}
                />
              </>
            )}
          </span>
        );
      })}
    </div>
  );
}

function formatRatingMeta(rating) {
  const date = formatRatingEventDate(
    rating.encounterAt || rating.updatedAt || rating.createdAt,
  );
  const score = `${Number(rating.rating).toFixed(1)} / 5`;
  return date ? `${date} · ${score}` : score;
}

function formatRatingEventDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString();
}

function getInitials(value) {
  return (
    value
      .split(/[.\s_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'MY'
  );
}

function mapOrganizerEventPage(data) {
  const items = Array.isArray(data?.items) ? data.items.map(mapApiEvent) : [];
  return {
    items,
    page: Number(data?.page) || 1,
    totalPages: Number(data?.totalPages) || 0,
  };
}

function mapApiEvent(event) {
  return {
    id: event.id,
    title: event.title || 'Untitled event',
    category: normalizeCategory(event.category),
    date: formatEventDate(event.date),
    rawDate: event.date,
    time: formatEventTime(event.time),
    rawTime: event.time,
    location: event.location || 'Location not shared',
    description: event.description || '',
    attendees: event.participantAvatars?.length
      ? event.participantAvatars
      : event.participantInitials || [],
    attendeeCount: event.participantsCount || 0,
    maxAttendees: event.maxAttendees || 0,
    minAge: event.minAge ?? null,
    maxAge: event.maxAge ?? null,
    ageLabel: formatAgeLimit(event.minAge, event.maxAge),
    isJoinedByCurrentUser: Boolean(event.isJoinedByCurrentUser),
    requiresParticipantApproval: Boolean(event.requiresParticipantApproval),
    joinRequestStatus: event.joinRequestStatus || null,
    pendingJoinRequestsCount: event.pendingJoinRequestsCount || 0,
    isSaved: Boolean(event.isSaved),
    organizerUsername: event.organizerUsername,
    createdByUserId: event.createdByUserId,
    isOrganizer: Boolean(event.isOrganizer),
    isCreator: Boolean(event.isCreator ?? event.isOrganizer),
  };
}

function formatAgeLimit(minAge, maxAge) {
  if (minAge != null && maxAge != null) return `Ages ${minAge}-${maxAge}`;
  if (minAge != null) return `${minAge}+`;
  if (maxAge != null) return `Up to ${maxAge}`;
  return '';
}

function normalizeCategory(category) {
  const value = (category || 'Social').trim().toUpperCase();
  if (value === 'SPORTS') return 'SPORT';
  return value;
}

function formatEventDate(value) {
  if (!value) return 'Date TBA';
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatEventTime(value) {
  if (!value) return 'Time TBA';
  const [hours = '00', minutes = '00'] = value.split(':');
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getCurrentUserId() {
  const token = localStorage.getItem('token');
  if (!token) return null;
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(normalized));
    return (
      decoded.nameid ||
      decoded.sub ||
      decoded[
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'
      ] ||
      null
    );
  } catch {
    return null;
  }
}

export default PublicProfile;
