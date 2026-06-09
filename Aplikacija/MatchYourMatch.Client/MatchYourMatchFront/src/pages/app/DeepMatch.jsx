import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DeepMatch.css';

function DeepMatch() {
  const [preferences, setPreferences] = useState(null);
  const [availability, setAvailability] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const loadDeepMatch = async () => {
      setLoading(true);
      setError('');

      try {
        const token = localStorage.getItem('token');
        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [preferencesResponse, availabilityResponse] = await Promise.all([
          fetch('/api/UserProfile/me/deep-preferences', { headers }),
          fetch('/api/UserProfile/me/availability', { headers }),
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

        const matchesResponse = await fetch('/api/DeepMatch/matches', { headers });

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
        setError(err.message || 'Deep matches could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    loadDeepMatch();
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
          <h1>Your Deep Matches</h1>
          <p>Sorted by compatibility based on your schedule, interests and preferences.</p>
          <div className="deep-match__accent-line" />
        </header>

        {loading && (
          <div className="deep-match__state">
            <div className="deep-match__spinner" aria-hidden="true" />
            <p>Loading your Deep Match profile...</p>
          </div>
        )}

        {!loading && error && (
          <div className="deep-match__state deep-match__state--error">
            <h2>Deep Match is unavailable</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && isIncomplete && (
          <div className="deep-match__state">
            <h2>Complete your profile first</h2>
            <p>
              Complete your Deep Match preferences and free time schedule on your profile to get
              better matches.
            </p>
            <button type="button" className="app-btn-pill" onClick={() => navigate('/app/profile')}>
              Go to profile
            </button>
          </div>
        )}

        {!loading && !error && !isIncomplete && matches.length === 0 && (
          <div className="deep-match__state">
            <h2>No deep matches yet</h2>
            <p>Try adding more interests or wider free time windows on your profile.</p>
            <button type="button" className="app-btn-pill" onClick={() => navigate('/app/profile')}>
              Edit preferences
            </button>
          </div>
        )}

        {!loading && !error && !isIncomplete && matches.length > 0 && (
          <section className="deep-match__results-list" aria-label="Deep Match results">
            {matches.map((match) => (
              <article key={match.userId} className="deep-match__result-card app-tilt-hover">
                <div className="deep-match__avatar">{match.initials}</div>
                <div className="deep-match__result-main">
                  <div className="deep-match__result-head">
                    <div>
                      <h2>{match.displayName || match.username}</h2>
                      <p>{match.location || 'Unknown location'}</p>
                    </div>
                    <span className="deep-match__score-badge">{match.compatibilityScore}%</span>
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
                    View details
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
