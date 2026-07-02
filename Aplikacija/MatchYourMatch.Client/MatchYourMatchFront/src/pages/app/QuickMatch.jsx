import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import './QuickMatch.css';
import { useTranslation } from '../../hooks/useTranslation';
import UserAvatar from '../../components/UserAvatar';
import UserActionsMenu from '../../components/UserActionsMenu';

const initialForm = {
  startTime: '',
  endTime: '',
  activityId: '',
  description: '',
  ageMin: '',
  ageMax: '',
};

const activitiesUrl = '/api/Activities';

const fixedQuickTimes = [
  {
    id: 'evening',
    label: '18:00 - 20:00',
    getTimes: () => ({ startTime: '18:00', endTime: '20:00' }),
  },
  {
    id: 'night',
    label: '20:00 - 22:00',
    getTimes: () => ({ startTime: '20:00', endTime: '22:00' }),
  },
];

const formatTime = (date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const roundUpToNextQuarter = (date) => {
  const rounded = new Date(date);
  const remainder = rounded.getMinutes() % 15;

  if (remainder !== 0) {
    rounded.setMinutes(rounded.getMinutes() + 15 - remainder);
  }

  rounded.setSeconds(0, 0);
  return rounded;
};

const getRelativeTimeWindow = (durationMinutes) => {
  const start = roundUpToNextQuarter(new Date());
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + durationMinutes);

  if (end.getDate() !== start.getDate()) {
    return {
      startTime: formatTime(start),
      endTime: '23:59',
    };
  }

  return {
    startTime: formatTime(start),
    endTime: formatTime(end),
  };
};

const getInitials = (name) => {
  if (!name) return '??';
  return name.trim().slice(0, 2).toUpperCase();
};

const mapMatchToProfile = (match, t) => {
  const overlapMinutes = match.overlapMinutes ?? 0;

  return {
    id: match.id,
    userId: match.userId,
    username: match.username,
    name: match.username,
    initials: getInitials(match.username),
    profilePicture: match.profilePicture,
    location: match.location || t('quick.unknownLocation'),
    timeRange: `${match.startTime} - ${match.endTime}`,
    message: match.description,
    interests: [
      match.activityName,
      match.activityCategoryName,
      t('quick.overlap', { count: overlapMinutes }),
    ].filter(Boolean),
    compatibility: Math.min(99, 60 + Math.floor(overlapMinutes / 5)),
  };
};

function QuickMatch() {
  const { t } = useTranslation();
  const [phase, setPhase] = useState('setup');
  const [form, setForm] = useState(initialForm);
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [activitiesError, setActivitiesError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stack, setStack] = useState([]);
  const [animating, setAnimating] = useState(null);
  const [selectedQuickTime, setSelectedQuickTime] = useState('');
  const [matchError, setMatchError] = useState('');
  const [matchMessage, setMatchMessage] = useState('');
  const [activePost, setActivePost] = useState(null);
  const [activePostLoading, setActivePostLoading] = useState(true);
  const [postLoading, setPostLoading] = useState(false);
  const [postMessage, setPostMessage] = useState('');
  const [postError, setPostError] = useState('');
  const [searchAttempted, setSearchAttempted] = useState(false);

  const top = stack[0];
  const remaining = stack.length;

  const quickTimeOptions = useMemo(
    () => [
      {
        id: 'now-1h',
        label: t('quick.nowOneHour'),
        getTimes: () => getRelativeTimeWindow(60),
      },
      {
        id: 'next-2h',
        label: t('quick.nextTwoHours'),
        getTimes: () => getRelativeTimeWindow(120),
      },
      ...fixedQuickTimes,
    ],
    [t],
  );

  const groupedActivities = useMemo(
    () =>
      activities.reduce((groups, activity) => {
        const category = activity.activityCategoryName || 'Other';
        if (!groups[category]) groups[category] = [];
        groups[category].push(activity);
        return groups;
      }, {}),
    [activities],
  );

  useEffect(() => {
    const loadActivities = async () => {
      try {
        const token = localStorage.getItem('token');

        if (!token) {
          console.error(
            'QuickMatch activities request skipped: missing JWT token.',
          );
          throw new Error('You must be logged in to load activities.');
        }

        const response = await fetch(activitiesUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const responseBody = await response.text();
          console.error('QuickMatch activities request failed:', {
            url: activitiesUrl,
            status: response.status,
            body: responseBody,
          });

          if (response.status === 401 || response.status === 403) {
            throw new Error('You are not authorized. Please log in again.');
          }

          if (response.status === 404) {
            throw new Error('Activities endpoint was not found.');
          }

          throw new Error('Activities could not be loaded.');
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          console.error(
            'QuickMatch activities response was not an array:',
            data,
          );
          throw new Error('Activities response was not valid.');
        }

        setActivities(data);
      } catch (error) {
        console.error('QuickMatch activities load error:', error);
        setActivitiesError(error.message || 'Activities could not be loaded.');
      } finally {
        setActivitiesLoading(false);
      }
    };

    loadActivities();
  }, [t]);

  useEffect(() => {
    const controller = new AbortController();
    const loadActivePost = async () => {
      try {
        const response = await fetch('/api/QuickMatch/post/active', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
          signal: controller.signal,
        });
        if (response.status === 204) return;
        if (!response.ok)
          throw new Error(
            (await response.text()) || t('quick.activeLoadError'),
          );
        const post = await response.json();
        setActivePost(post);
        setForm({
          startTime: post.startTime || '',
          endTime: post.endTime || '',
          activityId: String(post.activityId || ''),
          description: post.description || '',
          ageMin: post.preferredMinAge ?? '',
          ageMax: post.preferredMaxAge ?? '',
        });
      } catch (error) {
        if (error.name !== 'AbortError')
          setPostError(error.message || t('quick.activeLoadError'));
      } finally {
        setActivePostLoading(false);
      }
    };
    loadActivePost();
    return () => controller.abort();
  }, [t]);

  const validateForm = () => {
    if (!form.startTime) return t('quick.validationStart');
    if (!form.endTime) return t('quick.validationEnd');
    if (!form.activityId) return t('quick.validationActivity');
    if (form.startTime === form.endTime) return t('quick.validationOrder');
    if (form.ageMin && form.ageMax && Number(form.ageMin) > Number(form.ageMax))
      return t('quick.invalidAgeRange');
    return '';
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === 'startTime' || name === 'endTime') {
      setSelectedQuickTime('');
    }
    setFormError('');
    setPostMessage('');
    setPostError('');
  };

  const handleQuickTime = (option) => {
    const times = option.getTimes();

    setForm((current) => ({
      ...current,
      startTime: times.startTime,
      endTime: times.endTime,
    }));
    setSelectedQuickTime(option.id);
    setFormError('');
    setPostMessage('');
    setPostError('');
  };

  const getUtcWindow = () => {
    const [startHour, startMinute] = form.startTime.split(':').map(Number);
    const [endHour, endMinute] = form.endTime.split(':').map(Number);
    const startsAt = new Date();
    startsAt.setHours(startHour, startMinute, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(endHour, endMinute, 0, 0);
    if (endsAt <= startsAt) endsAt.setDate(endsAt.getDate() + 1);
    return {
      startsAtUtc: startsAt.toISOString(),
      endsAtUtc: endsAt.toISOString(),
    };
  };

  const nullableAge = (value) => (value === '' ? null : Number(value));

  const getRequestBody = (action) => ({
    startTime: form.startTime,
    endTime: form.endTime,
    activityId: Number(form.activityId),
    ...(action === 'post' ? { description: form.description.trim() } : {}),
    ...getUtcWindow(),
    ...(action === 'find'
      ? { minAge: nullableAge(form.ageMin), maxAge: nullableAge(form.ageMax) }
      : {
          preferredMinAge: nullableAge(form.ageMin),
          preferredMaxAge: nullableAge(form.ageMax),
        }),
  });

  const handleSubmit = async (event) => {
    event.preventDefault();

    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }

    setLoading(true);
    setFormError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/QuickMatch/matches', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(getRequestBody('find')),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Matches could not be loaded.');
      }

      const data = await response.json();
      const matches = data.map((match) => mapMatchToProfile(match, t));
      setStack(matches);
      setAnimating(null);
      setSearchAttempted(true);
      if (matches.length > 0) setPhase('matching');
    } catch (error) {
      setFormError(error.message || 'Matches could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const handlePost = async () => {
    const error = validateForm();
    if (error) {
      setFormError(error);
      return;
    }
    setPostLoading(true);
    setFormError('');
    setPostError('');
    setPostMessage('');
    try {
      const editing = Boolean(activePost?.id);
      const response = await fetch(
        editing
          ? `/api/QuickMatch/post/${activePost.id}`
          : '/api/QuickMatch/post',
        {
          method: editing ? 'PUT' : 'POST',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(getRequestBody('post')),
        },
      );
      if (!response.ok)
        throw new Error((await response.text()) || t('quick.postError'));
      setActivePost(await response.json());
      setPostMessage(editing ? t('quick.updated') : t('quick.posted'));
    } catch (error) {
      setPostError(error.message || t('quick.postError'));
    } finally {
      setPostLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!activePost?.id || postLoading) return;
    setPostLoading(true);
    setPostError('');
    setPostMessage('');
    try {
      const response = await fetch(`/api/QuickMatch/post/${activePost.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok)
        throw new Error((await response.text()) || t('quick.deleteError'));
      setActivePost(null);
      setPostMessage(t('quick.deleted'));
    } catch (error) {
      setPostError(error.message || t('quick.deleteError'));
    } finally {
      setPostLoading(false);
    }
  };

  const returnToSetup = () => {
    setPhase('setup');
    setStack([]);
    setAnimating(null);
  };

  const handleAction = async (action) => {
    if (!top || animating) return;
    setMatchError('');
    setMatchMessage('');

    if (action === 'match') {
      try {
        const response = await fetch(`/api/QuickMatch/${top.id}/requests`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        if (!response.ok)
          throw new Error((await response.text()) || t('quick.unavailable'));
        setMatchMessage(t('quick.requestSent'));
      } catch (error) {
        setMatchError(error.message || t('quick.unavailable'));
        return;
      }
    }

    setAnimating(action);
    setTimeout(() => {
      setStack((prev) => prev.slice(1));
      setAnimating(null);
    }, 420);
  };

  if (phase === 'setup') {
    return (
      <div className='page-fade-in quick-match'>
        <div className='quick-match__atmo' aria-hidden='true'>
          <span className='quick-match__glow' />
          <span className='quick-match__vignette' />
        </div>

        <section className='quick-match__setup'>
          <form className='quick-match__setup-card' onSubmit={handleSubmit}>
            <h1 className='quick-match__setup-title'>{t('quick.title')}</h1>
            <p className='quick-match__setup-text'>{t('quick.subtitle')}</p>

            <div className='quick-match__time-section'>
              <span className='quick-match__label'>{t('quick.free')}</span>
              <div
                className='quick-match__time-options'
                aria-label={t('quick.windows')}
              >
                {quickTimeOptions.map((option) => (
                  <button
                    key={option.id}
                    type='button'
                    className={`quick-match__time-chip${
                      selectedQuickTime === option.id
                        ? ' quick-match__time-chip--active'
                        : ''
                    }`}
                    onClick={() => handleQuickTime(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className='quick-match__time-grid'>
              <label className='quick-match__field'>
                <span className='quick-match__label'>{t('quick.start')}</span>
                <input
                  className='quick-match__input quick-match__input--time'
                  type='time'
                  name='startTime'
                  value={form.startTime}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className='quick-match__field'>
                <span className='quick-match__label'>{t('quick.end')}</span>
                <input
                  className='quick-match__input quick-match__input--time'
                  type='time'
                  name='endTime'
                  value={form.endTime}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <label className='quick-match__field'>
              <span className='quick-match__label'>{t('quick.activity')}</span>
              <select
                className='quick-match__select'
                name='activityId'
                value={form.activityId}
                onChange={handleChange}
                disabled={
                  activitiesLoading ||
                  !!activitiesError ||
                  activities.length === 0
                }
                required
              >
                <option value=''>
                  {activitiesLoading && t('quick.loadingActivities')}
                  {!activitiesLoading &&
                    activitiesError &&
                    t('quick.unavailableActivities')}
                  {!activitiesLoading &&
                    !activitiesError &&
                    activities.length === 0 &&
                    t('quick.noActivities')}
                  {!activitiesLoading &&
                    !activitiesError &&
                    activities.length > 0 &&
                    t('quick.chooseActivity')}
                </option>
                {Object.entries(groupedActivities).map(([category, items]) => (
                  <optgroup key={category} label={category}>
                    {items.map((activity) => (
                      <option key={activity.id} value={activity.id}>
                        {activity.displayName}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>

            <fieldset className='quick-match__field quick-match__age-range'>
              <legend className='quick-match__label'>
                {t('quick.agePreferenceOptional')}
              </legend>
              <div className='quick-match__time-grid'>
                <label>
                  <span>{t('quick.minimumAge')}</span>
                  <input
                    className='quick-match__input'
                    type='number'
                    min='16'
                    max='120'
                    name='ageMin'
                    value={form.ageMin}
                    onChange={handleChange}
                    placeholder={t('quick.anyAge')}
                  />
                </label>
                <label>
                  <span>{t('quick.maximumAge')}</span>
                  <input
                    className='quick-match__input'
                    type='number'
                    min='16'
                    max='120'
                    name='ageMax'
                    value={form.ageMax}
                    onChange={handleChange}
                    placeholder={t('quick.anyAge')}
                  />
                </label>
              </div>
              <small>{t('quick.noPreference')}</small>
            </fieldset>

            <label className='quick-match__field'>
              <span className='quick-match__label'>{t('quick.message')}</span>
              <textarea
                className='quick-match__textarea'
                name='description'
                value={form.description}
                onChange={handleChange}
                placeholder={t('quick.optional')}
                maxLength={500}
              />
            </label>

            {(formError || postError || activitiesError) && (
              <p className='quick-match__error'>
                {formError || postError || activitiesError}
              </p>
            )}
            {postMessage && (
              <p className='quick-match__success'>{postMessage}</p>
            )}
            {!activitiesLoading &&
              !activitiesError &&
              activities.length === 0 && (
                <p className='quick-match__error'>
                  No activities available. Activities must exist in the database
                  before this dropdown can be used.
                </p>
              )}

            <button
              type='submit'
              className='quick-match__submit app-interactive'
              disabled={
                loading ||
                activitiesLoading ||
                !!activitiesError ||
                activities.length === 0
              }
            >
              {loading ? t('quick.finding') : t('quick.find')}
            </button>

            <button
              type='button'
              className='quick-match__post-button app-interactive'
              disabled={
                postLoading ||
                activePostLoading ||
                activitiesLoading ||
                !!activitiesError ||
                activities.length === 0
              }
              onClick={handlePost}
            >
              {postLoading
                ? t('common.working')
                : activePost
                  ? t('quick.updatePost')
                  : t('quick.post')}
            </button>

            {activePost && (
              <section className='quick-match__active-post' aria-live='polite'>
                <div>
                  <strong>{t('quick.activePost')}</strong>
                  <span>
                    {activePost.startTime} - {activePost.endTime}
                  </span>
                </div>
                <p>
                  {activePost.activityName}
                  {activePost.description ? ` · ${activePost.description}` : ''}
                </p>
                <button
                  type='button'
                  onClick={handleDeletePost}
                  disabled={postLoading}
                >
                  {t('quick.deletePost')}
                </button>
              </section>
            )}

            {searchAttempted && stack.length === 0 && (
              <section className='quick-match__no-results'>
                <strong>{t('quick.noMatchesNow')}</strong>
                <p>{t('quick.postPrompt')}</p>
                <button
                  type='button'
                  onClick={handlePost}
                  disabled={postLoading || activePostLoading}
                >
                  {activePost
                    ? t('quick.updatePost')
                    : t('quick.postThesePlans')}
                </button>
              </section>
            )}
          </form>
        </section>
      </div>
    );
  }

  if (!top) {
    return (
      <div className='page-fade-in quick-match'>
        <div className='quick-match__atmo' aria-hidden='true'>
          <span className='quick-match__glow' />
          <span className='quick-match__vignette' />
        </div>
        <div className='app-empty quick-match__empty-wrap'>
          <p className='app-empty__title'>{t('quick.caughtUp')}</p>
          <p className='app-empty__text'>{t('quick.noMore')}</p>
          <button
            type='button'
            className='quick-match__back app-interactive'
            onClick={returnToSetup}
          >
            {t('quick.tryAnother')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className='page-fade-in quick-match'>
      <div className='quick-match__atmo' aria-hidden='true'>
        <span className='quick-match__glow' />
        <span className='quick-match__vignette' />
      </div>

      <p className='quick-match__status'>
        {t('quick.remaining', { count: remaining })}
      </p>
      {matchError && <p className='quick-match__error'>{matchError}</p>}
      {matchMessage && <p className='quick-match__success'>{matchMessage}</p>}

      <div className='quick-match__stack'>
        {stack
          .slice()
          .reverse()
          .map((profile, i, arr) => {
            const isTop = i === arr.length - 1;
            const depth = arr.length - 1 - i;
            return (
              <article
                key={profile.id}
                className={`quick-match__card${isTop ? ' quick-match__card--top' : ''}${
                  isTop && animating === 'skip'
                    ? ' quick-match__card--skip'
                    : ''
                }${isTop && animating === 'match' ? ' quick-match__card--match' : ''}`}
                style={{ '--depth': depth, zIndex: i + 1 }}
              >
                {isTop && (
                  <UserActionsMenu
                    className='quick-match__user-actions'
                    userId={profile.userId}
                    username={profile.username}
                    context='matchCard'
                    onHidden={(id) =>
                      setStack((current) =>
                        current.filter((item) => item.userId !== id),
                      )
                    }
                    onBlocked={(id) =>
                      setStack((current) =>
                        current.filter((item) => item.userId !== id),
                      )
                    }
                  />
                )}
                <span className='quick-match__compat'>
                  <span className='quick-match__compat-val'>
                    {profile.compatibility}%
                  </span>
                  <span className='quick-match__compat-label'>
                    {t('quick.match')}
                  </span>
                </span>
                <UserAvatar
                  className='quick-match__avatar'
                  profilePicture={profile.profilePicture}
                  initials={profile.initials}
                  alt=''
                />
                <h2 className='quick-match__name'>{profile.name}</h2>
                <p className='quick-match__meta'>
                  {profile.location} - {profile.timeRange}
                </p>
                {profile.message && (
                  <p className='quick-match__message'>{profile.message}</p>
                )}
                <div className='quick-match__tags'>
                  {profile.interests.map((tag) => (
                    <span key={tag} className='quick-match__tag'>
                      {tag}
                    </span>
                  ))}
                </div>
                <div className='quick-match__bar-wrap'>
                  <div
                    className='quick-match__bar-fill'
                    style={{ width: `${profile.compatibility}%` }}
                  />
                </div>
              </article>
            );
          })}
      </div>

      <div className='quick-match__actions'>
        <button
          type='button'
          className='quick-match__btn quick-match__btn--skip app-interactive'
          aria-label={t('quick.skip')}
          onClick={() => handleAction('skip')}
          disabled={!!animating}
        >
          <X size={22} strokeWidth={1.75} />
        </button>
        <button
          type='button'
          className='quick-match__btn quick-match__btn--match app-interactive'
          aria-label={t('quick.title')}
          onClick={() => handleAction('match')}
          disabled={!!animating}
        >
          &hearts;
        </button>
      </div>
    </div>
  );
}

export default QuickMatch;
