import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
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
  }, [id, t]);

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
  const currentUserId = useMemo(() => getCurrentUserId(), []);
  const selectedRatingEvent = ratingStatus?.eligibleEvents?.find(
    (event) => String(event.eventId) === selectedEventId,
  );
  const unratedEligibleEvents =
    ratingStatus?.eligibleEvents?.filter((event) => event.myRating == null) ||
    [];

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
              {!isBlocked && profile.canMessage !== false && (
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
              {!isBlocked && profile.canMessage === false && (
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
