import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DeepMatch.css';
import { useTranslation } from '../../hooks/useTranslation';
import UserAvatar from '../../components/UserAvatar';
import UserActionsMenu from '../../components/UserActionsMenu';

function DeepMatch() {
  const [preferences, setPreferences] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const controller = new AbortController();
    const loadDeepMatch = async () => {
      setLoading(true);
      setError('');

      try {
        const token = localStorage.getItem('token');
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [preferencesResponse, availabilityResponse] = await Promise.all([
          fetch('/api/UserProfile/me/deep-preferences', { headers, signal:controller.signal }),
          fetch('/api/UserProfile/me/availability', { headers, signal:controller.signal }),
        ]);

        if (preferencesResponse.status === 401 || availabilityResponse.status === 401) {
          throw new Error('Your session expired. Please log in again.');
        }

        if (!preferencesResponse.ok || !availabilityResponse.ok) {
          throw new Error('Deep Match profile data could not be loaded.');
        }

        const preferencesData = await preferencesResponse.json();
        const availabilityData = await availabilityResponse.json();

        setPreferences(preferencesData);
        setAvailability(availabilityData);

        if (!preferencesData.isComplete || availabilityData.length === 0) {
          setMatches([]);
          return;
        }

        const matchesResponse = await fetch('/api/DeepMatch/matches', { headers, signal:controller.signal });

        if (matchesResponse.status === 401 || matchesResponse.status === 403) {
          throw new Error('Your session expired. Please log in again.');
        }

        if (!matchesResponse.ok) {
          const body = await matchesResponse.text();
          throw new Error(body || 'Deep matches could not be loaded.');
        }

        const matchesData = await matchesResponse.json();
        setMatches(matchesData);
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Deep matches could not be loaded.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadDeepMatch();
    return () => controller.abort();
  }, []);

  const isIncomplete = !preferences?.isComplete || availability.length === 0;

  return (
    <div className="page-fade-in deep-match">
      <div className="deep-match__atmo" aria-hidden="true">
        <span className="deep-match__mesh" />
        <span className="deep-match__vignette" />
      </div>

      <main className="deep-match__shell">
        <header className="deep-match__hero">
          <h1>{t('deep.title')}</h1>
          <p>{t('deep.subtitle')}</p>
          <div className="deep-match__accent-line" />
        </header>

        {loading && (
          <div className="deep-match__state">
            <div className="deep-match__spinner" aria-hidden="true" />
            <p>{t('deep.loading')}</p>
          </div>
        )}

        {!loading && error && (
          <div className="deep-match__state deep-match__state--error">
            <h2>{t('deep.unavailable')}</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && isIncomplete && (
          <div className="deep-match__state">
            <h2>{t('deep.completeTitle')}</h2>
            <p>{t('deep.completeText')}</p>
            <button type="button" className="app-btn-pill" onClick={() => navigate('/app/profile')}>
              {t('deep.goProfile')}
            </button>
          </div>
        )}

        {!loading && !error && !isIncomplete && matches.length === 0 && (
          <div className="deep-match__state">
            <h2>{t('deep.none')}</h2>
            <p>{t('deep.noneText')}</p>
            <button type="button" className="app-btn-pill" onClick={()=>navigate('/app/profile')}>
              {t('deep.edit')}
            </button>
          </div>
        )}

        {!loading && !error && !isIncomplete && matches.length > 0 && (
          <section className="deep-match__results-list" aria-label={t('deep.results')}>
            {matches.map((match) => (
              <article key={match.userId} className="deep-match__result-card app-tilt-hover">
                <UserAvatar className="deep-match__avatar" profilePicture={match.profilePicture}
                  initials={match.initials} alt="" />
                <div className="deep-match__result-main">
                  <div className="deep-match__result-head">
                    <div>
                      <h2>{match.displayName || match.username}</h2>
                      <p>{match.location || t('deep.unknownLocation')}</p>
                    </div>
                    <div className="deep-match__card-actions"><span className="deep-match__score-badge">{match.compatibilityScore}%</span>
                      <UserActionsMenu userId={match.userId} username={match.username} context="matchCard"
                        onHidden={(id) => setMatches(current => current.filter(item => item.userId !== id))}
                        onBlocked={(id) => setMatches(current => current.filter(item => item.userId !== id))} />
                    </div>
                  </div>

                  {match.about && <p className="deep-match__about">{match.about}</p>}

                  <div className="deep-match__reason-list">
                    {match.reasons.map((reason) => (
                      <span key={reason}>{reason}</span>
                    ))}
                  </div>

                  <div className="deep-match__chips">
                    {match.approximateDistanceLabel && (
                      <span>{match.approximateDistanceLabel}</span>
                    )}
                    {match.sharedInterests.map((interest) => (
                      <span key={`interest-${interest}`}>{interest}</span>
                    ))}
                    {match.sharedActivities.map((activity) => (
                      <span key={`activity-${activity}`}>{activity}</span>
                    ))}
                    {match.overlappingAvailability.map((overlap) => (
                      <span key={`overlap-${overlap}`}>{overlap}</span>
                    ))}
                  </div>

                  <button type="button" className="app-btn-pill app-btn-pill--outline deep-match__view">
                    {t('deep.viewDetails')}
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}

export default DeepMatch;
