import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Hash, Search, Sparkles, User } from 'lucide-react';
import './SearchResults.css';
import { useTranslation } from '../../hooks/useTranslation';
import UserAvatar from '../../components/UserAvatar';
import UserActionsMenu from '../../components/UserActionsMenu';
import { isGuestSession, isOrganizerSession } from '../../services/guestSession';

const emptyResults = {
  people: [],
  events: [],
  activities: [],
  interests: [],
};

function SearchResults() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [inputValue, setInputValue] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState(emptyResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const query = (searchParams.get('q') || '').trim();
  const eventsOnlySearch = isOrganizerSession() || isGuestSession();

  const hasResults = useMemo(
    () =>
      (!eventsOnlySearch && results.people.length > 0) ||
      results.events.length > 0 ||
      (!eventsOnlySearch && results.activities.length > 0) ||
      (!eventsOnlySearch && results.interests.length > 0),
    [eventsOnlySearch, results],
  );

  useEffect(() => {
    setInputValue(query);

    if (query.length < 2) {
      setResults(emptyResults);
      setError('');
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();

    async function loadResults() {
      const requestUrl = `/api/Search?query=${encodeURIComponent(query)}`;
      const token = localStorage.getItem('token');

      setLoading(true);
      setError('');

      try {
        const response = await fetch(requestUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (response.status === 401 || response.status === 403) {
          setResults(emptyResults);
          setError('Please log in again');
          return;
        }

        if (!response.ok) {
          await response.text();
          setResults(emptyResults);
          setError('Search could not be loaded');
          return;
        }

        const body = await response.json();
        setResults(normalizeResults(body, eventsOnlySearch));
      } catch (err) {
        if (err.name !== 'AbortError') {
          setResults(emptyResults);
          setError('Search could not be loaded');
        }
      } finally {
        setLoading(false);
      }
    }

    loadResults();

    return () => controller.abort();
  }, [eventsOnlySearch, query]);

  const handleSubmit = (event) => {
    event.preventDefault();
    const nextQuery = inputValue.trim();

    if (nextQuery.length >= 2) {
      setSearchParams({ q: nextQuery });
    }
  };

  return (
    <main className='search-results'>
      <section className='search-results__hero'>
        <p className='search-results__eyebrow'>{t('searchPage.eyebrow')}</p>
        <h1>{t('searchPage.title')}</h1>
        <form className='search-results__form' onSubmit={handleSubmit}>
          <Search size={18} aria-hidden='true' />
          <input
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={eventsOnlySearch ? 'Search events...' : 'Search people, events, activities...'}
            aria-label='Search query'
          />
          <button type='submit'>{t('searchPage.action')}</button>
        </form>
      </section>

      {query.length < 2 && (
        <div className='search-results__state'>{t('searchPage.hint')}</div>
      )}

      {query.length >= 2 && loading && (
        <div className='search-results__state'>{t('searchPage.loading')}</div>
      )}

      {query.length >= 2 && !loading && error && (
        <div className='search-results__state search-results__state--error'>
          {error}
        </div>
      )}

      {query.length >= 2 && !loading && !error && !hasResults && (
        <div className='search-results__state'>
          No results found for "{query}".
        </div>
      )}

      {query.length >= 2 && !loading && !error && hasResults && (
        <div className='search-results__grid'>
          {!eventsOnlySearch && (
            <ResultSection
              title='People'
              icon={<User size={17} />}
              items={results.people}
            >
              {(person) => (
                <div
                  className='search-results__person-wrap'
                  key={`person-${person.id}`}
                >
                  <button
                    type='button'
                    className='search-results__card'
                    onClick={() => navigate(`/app/users/${person.id}`)}
                  >
                    <UserAvatar
                      className='search-results__avatar'
                      profilePicture={person.profilePicture}
                      initials={getInitials(
                        person.displayName || person.username,
                      )}
                      alt=''
                    />
                    <span className='search-results__content'>
                      <strong>
                        {person.displayName || person.username}
                        {person.isPrivate && !person.canViewPrivateContent && (
                          <span className='search-results__badge'>Private</span>
                        )}
                      </strong>
                      <small>
                        @{person.username}
                        {person.canViewPrivateContent && person.locationDisplayName
                          ? ` - ${person.locationDisplayName}`
                          : ''}
                      </small>
                      {person.canViewPrivateContent && person.tags?.length > 0 && (
                        <em>{person.tags.slice(0, 3).join(' - ')}</em>
                      )}
                    </span>
                  </button>
                  <UserActionsMenu
                    userId={person.id}
                    username={person.username}
                    context='matchCard'
                    onHidden={(id) =>
                      setResults((current) => ({
                        ...current,
                        people: current.people.filter((item) => item.id !== id),
                      }))
                    }
                    onBlocked={(id) =>
                      setResults((current) => ({
                        ...current,
                        people: current.people.filter((item) => item.id !== id),
                      }))
                    }
                  />
                </div>
              )}
            </ResultSection>
          )}

          <ResultSection
            title='Events'
            icon={<CalendarDays size={17} />}
            items={results.events}
          >
            {(event) => (
              <button
                type='button'
                className='search-results__card'
                key={`event-${event.id}`}
                onClick={() => navigate('/app/events')}
              >
                <span className='search-results__icon'>EV</span>
                <span className='search-results__content'>
                  <strong>{event.title}</strong>
                  <small>
                    {formatEventDate(event.dateTime)} - {event.location}
                  </small>
                  {event.categoryName && <em>{event.categoryName}</em>}
                </span>
              </button>
            )}
          </ResultSection>

          {!eventsOnlySearch && (
            <ResultSection
              title='Activities'
              icon={<Sparkles size={17} />}
              items={results.activities}
            >
              {(activity) => (
                <button
                  type='button'
                  className='search-results__card'
                  key={`activity-${activity.id}`}
                  onClick={() => navigate('/app/quick-match')}
                >
                  <span className='search-results__icon'>AC</span>
                  <span className='search-results__content'>
                    <strong>{activity.displayName}</strong>
                    <small>{activity.categoryName}</small>
                  </span>
                </button>
              )}
            </ResultSection>
          )}

          {!eventsOnlySearch && (
            <ResultSection
              title='Interests'
              icon={<Hash size={17} />}
              items={results.interests}
            >
              {(interest) => (
                <article
                  className='search-results__card'
                  key={`interest-${interest.id}`}
                >
                  <span className='search-results__icon'>#</span>
                  <span className='search-results__content'>
                    <strong>{interest.name}</strong>
                    <small>
                      {interest.category || 'Interest'} - {interest.count} people
                    </small>
                  </span>
                </article>
              )}
            </ResultSection>
          )}
        </div>
      )}
    </main>
  );
}

function ResultSection({ title, icon, items, children }) {
  if (!items.length) {
    return null;
  }

  return (
    <section className='search-results__section'>
      <header className='search-results__section-head'>
        <span>{icon}</span>
        <h2>{title}</h2>
        <small>{items.length}</small>
      </header>
      <div className='search-results__list'>{items.map(children)}</div>
    </section>
  );
}

function normalizeResults(body, eventsOnlySearch) {
  return {
    people: !eventsOnlySearch && Array.isArray(body.people) ? body.people : [],
    events: Array.isArray(body.events) ? body.events : [],
    activities: !eventsOnlySearch && Array.isArray(body.activities) ? body.activities : [],
    interests: !eventsOnlySearch && Array.isArray(body.interests) ? body.interests : [],
  };
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

function formatEventDate(value) {
  if (!value) {
    return 'Event';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Event';
  }

  return date.toLocaleString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default SearchResults;
