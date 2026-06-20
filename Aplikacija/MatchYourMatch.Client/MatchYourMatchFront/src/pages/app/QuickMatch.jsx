import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import './QuickMatch.css';
import { useTranslation } from '../../hooks/useTranslation';

const initialForm = {
  startTime: '',
  endTime: '',
  activityId: '',
  description: '',
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
    name: match.username,
    initials: getInitials(match.username),
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
          console.error('QuickMatch activities request skipped: missing JWT token.');
          throw new Error('You must be logged in to load activities.');
        }

        console.log('QuickMatch activities request URL:', activitiesUrl);

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
          console.error('QuickMatch activities response was not an array:', data);
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

  const validateForm = () => {
    if (!form.startTime) return t('quick.validationStart');
    if (!form.endTime) return t('quick.validationEnd');
    if (!form.activityId) return t('quick.validationActivity');
    if (form.startTime >= form.endTime) return t('quick.validationOrder');
    return '';
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    if (name === 'startTime' || name === 'endTime') {
      setSelectedQuickTime('');
    }
    setFormError('');
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
  };

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
        body: JSON.stringify({
          startTime: form.startTime,
          endTime: form.endTime,
          activityId: Number(form.activityId),
          description: form.description.trim(),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Matches could not be loaded.');
      }

      const data = await response.json();
      setStack(data.map((match) => mapMatchToProfile(match, t)));
      setAnimating(null);
      setPhase('matching');
    } catch (error) {
      setFormError(error.message || 'Matches could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const returnToSetup = () => {
    setPhase('setup');
    setStack([]);
    setAnimating(null);
  };

  const handleAction = (action) => {
    if (!top || animating) return;
    setAnimating(action);
    setTimeout(() => {
      setStack((prev) => prev.slice(1));
      setAnimating(null);
    }, 420);
  };

  if (phase === 'setup') {
    return (
      <div className="page-fade-in quick-match">
        <div className="quick-match__atmo" aria-hidden="true">
          <span className="quick-match__glow" />
          <span className="quick-match__vignette" />
        </div>

        <section className="quick-match__setup">
          <form className="quick-match__setup-card" onSubmit={handleSubmit}>
            <h1 className="quick-match__setup-title">{t('quick.title')}</h1>
            <p className="quick-match__setup-text">{t('quick.subtitle')}</p>

            <div className="quick-match__time-section">
              <span className="quick-match__label">{t('quick.free')}</span>
              <div className="quick-match__time-options" aria-label={t('quick.windows')}>
                {quickTimeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`quick-match__time-chip${
                      selectedQuickTime === option.id ? ' quick-match__time-chip--active' : ''
                    }`}
                    onClick={() => handleQuickTime(option)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="quick-match__time-grid">
              <label className="quick-match__field">
                <span className="quick-match__label">{t('quick.start')}</span>
                <input
                  className="quick-match__input quick-match__input--time"
                  type="time"
                  name="startTime"
                  value={form.startTime}
                  onChange={handleChange}
                  required
                />
              </label>

              <label className="quick-match__field">
                <span className="quick-match__label">{t('quick.end')}</span>
                <input
                  className="quick-match__input quick-match__input--time"
                  type="time"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleChange}
                  required
                />
              </label>
            </div>

            <label className="quick-match__field">
              <span className="quick-match__label">{t('quick.activity')}</span>
              <select
                className="quick-match__select"
                name="activityId"
                value={form.activityId}
                onChange={handleChange}
                disabled={activitiesLoading || !!activitiesError || activities.length === 0}
                required
              >
                <option value="">
                  {activitiesLoading && t('quick.loadingActivities')}
                  {!activitiesLoading && activitiesError && t('quick.unavailableActivities')}
                  {!activitiesLoading && !activitiesError && activities.length === 0 && t('quick.noActivities')}
                  {!activitiesLoading && !activitiesError && activities.length > 0 && t('quick.chooseActivity')}
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

            <label className="quick-match__field">
              <span className="quick-match__label">{t('quick.message')}</span>
              <textarea
                className="quick-match__textarea"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder={t('quick.optional')}
                maxLength={500}
              />
            </label>

            {(formError || activitiesError) && (
              <p className="quick-match__error">{formError || activitiesError}</p>
            )}
            {!activitiesLoading && !activitiesError && activities.length === 0 && (
              <p className="quick-match__error">
                No activities available. Activities must exist in the database before this
                dropdown can be used.
              </p>
            )}

            <button
              type="submit"
              className="quick-match__submit app-interactive"
              disabled={loading || activitiesLoading || !!activitiesError || activities.length === 0}
            >
              {loading ? t('quick.finding') : t('quick.find')}
            </button>
          </form>
        </section>
      </div>
    );
  }

  if (!top) {
    return (
      <div className="page-fade-in quick-match">
        <div className="quick-match__atmo" aria-hidden="true">
          <span className="quick-match__glow" />
          <span className="quick-match__vignette" />
        </div>
        <div className="app-empty quick-match__empty-wrap">
          <p className="app-empty__title">{t('quick.caughtUp')}</p>
          <p className="app-empty__text">{t('quick.noMore')}</p>
          <button type="button" className="quick-match__back app-interactive" onClick={returnToSetup}>
            {t('quick.tryAnother')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in quick-match">
      <div className="quick-match__atmo" aria-hidden="true">
        <span className="quick-match__glow" />
        <span className="quick-match__vignette" />
      </div>

      <p className="quick-match__status">{t('quick.remaining', { count: remaining })}</p>

      <div className="quick-match__stack">
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
                  isTop && animating === 'skip' ? ' quick-match__card--skip' : ''
                }${isTop && animating === 'match' ? ' quick-match__card--match' : ''}`}
                style={{ '--depth': depth, zIndex: i + 1 }}
              >
                <span className="quick-match__compat">
                  <span className="quick-match__compat-val">{profile.compatibility}%</span>
                  <span className="quick-match__compat-label">{t('quick.match')}</span>
                </span>
                <div className="quick-match__avatar">{profile.initials}</div>
                <h2 className="quick-match__name">{profile.name}</h2>
                <p className="quick-match__meta">
                  {profile.location} - {profile.timeRange}
                </p>
                {profile.message && <p className="quick-match__message">{profile.message}</p>}
                <div className="quick-match__tags">
                  {profile.interests.map((tag) => (
                    <span key={tag} className="quick-match__tag">
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="quick-match__bar-wrap">
                  <div
                    className="quick-match__bar-fill"
                    style={{ width: `${profile.compatibility}%` }}
                  />
                </div>
              </article>
            );
          })}
      </div>

      <div className="quick-match__actions">
        <button
          type="button"
          className="quick-match__btn quick-match__btn--skip app-interactive"
          aria-label={t('quick.skip')}
          onClick={() => handleAction('skip')}
          disabled={!!animating}
        >
          <X size={22} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          className="quick-match__btn quick-match__btn--match app-interactive"
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
