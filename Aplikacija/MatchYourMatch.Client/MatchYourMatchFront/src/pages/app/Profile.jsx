import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MapPin,
  Heart,
  Calendar,
  Star,
  MessageCircle,
  Music,
  Coffee,
  Moon,
} from 'lucide-react';
import EventCard from '../../components/EventCard';
import AvailabilityScheduleEditor from '../../components/profile/AvailabilityScheduleEditor';
import DeepPreferencesSection from '../../components/profile/DeepPreferencesSection';
import { CURRENT_USER, matches, LITTLE_THINGS } from '../../data/matches';
import { events } from '../../data/events';
import './Profile.css';

const TABS = ['ABOUT', 'MATCHES', 'EVENTS'];
const EVENT_SEGMENTS = ['Upcoming', 'Past', 'Saved'];

const ACTIVITIES = ['Live music', 'Gallery nights', 'Rooftop hangs', 'Road trips'];
const SOCIAL_ENERGY = 72;
const CONVERSATION = 'Thoughtful & playful';

function Profile(props) {
  const [tab, setTab] = useState('ABOUT');
  const [eventSegment, setEventSegment] = useState('Upcoming');
  const [profileEditing, setProfileEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [locationDraft, setLocationDraft] = useState('');
  const [locationPrivacyDraft, setLocationPrivacyDraft] = useState('CityOnly');
  const [profileLocation, setProfileLocation] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileLocationPrivacy, setProfileLocationPrivacy] = useState('CityOnly');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSuggestionsLoading, setLocationSuggestionsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const location = props.currentUser?.locationDisplayName || props.currentUser?.location || '';
    const locationInput = props.currentUser?.locationRawInput || location;
    const bio = props.currentUser?.bio || '';
    const privacy = props.currentUser?.locationPrivacy || 'CityOnly';
    setProfileLocation(location);
    setLocationDraft(locationInput);
    setProfileBio(bio);
    setBioDraft(bio);
    setProfileLocationPrivacy(privacy);
    setLocationPrivacyDraft(privacy);
  }, [
    props.currentUser?.bio,
    props.currentUser?.location,
    props.currentUser?.locationDisplayName,
    props.currentUser?.locationRawInput,
    props.currentUser?.locationPrivacy,
  ]);

  useEffect(() => {
    if (!profileEditing) {
      setLocationSuggestions([]);
      setLocationSuggestionsLoading(false);
      return;
    }

    const query = locationDraft.trim();

    if (query.length < 3) {
      setLocationSuggestions([]);
      setLocationSuggestionsLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setLocationSuggestionsLoading(true);

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(
          `/api/UserProfile/location-suggestions?query=${encodeURIComponent(query)}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          setLocationSuggestions([]);
          return;
        }

        const suggestions = await response.json();
        setLocationSuggestions(Array.isArray(suggestions) ? suggestions : []);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setLocationSuggestions([]);
        }
      } finally {
        setLocationSuggestionsLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [locationDraft, profileEditing]);

  const handleLogout = () => {
    localStorage.removeItem('mym_authed');
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("tokenChanged"))
    navigate('/');
  };

  const statCards = [
    { icon: Heart, label: 'Matches', value: '24' },
    { icon: Calendar, label: 'Events Joined', value: '7' },
    { icon: Star, label: 'Profile Score', value: '91%' },
    { icon: MessageCircle, label: 'Response Rate', value: '94%' },
  ];

  const eventLists = {
    Upcoming: events.slice(0, 2),
    Past: events.slice(2, 4),
    Saved: events.slice(4, 6),
  };

  const handleProfileEdit = () => {
    setLocationDraft(props.currentUser?.locationRawInput || profileLocation);
    setBioDraft(profileBio);
    setLocationPrivacyDraft(profileLocationPrivacy);
    setProfileError('');
    setProfileSuccess('');
    setLocationSuggestions([]);
    setProfileEditing(true);
  };

  const handleProfileCancel = () => {
    setLocationDraft(props.currentUser?.locationRawInput || profileLocation);
    setBioDraft(profileBio);
    setLocationPrivacyDraft(profileLocationPrivacy);
    setProfileError('');
    setProfileSuccess('');
    setLocationSuggestions([]);
    setProfileEditing(false);
  };

  const handleLocationDraftChange = (event) => {
    setLocationDraft(event.target.value);
    setProfileSuccess('');
  };

  const handleLocationSuggestionSelect = (suggestion) => {
    setLocationDraft(suggestion.locationInput || suggestion.displayName);
    setProfileError('');
    setProfileSuccess('');
    setLocationSuggestions([]);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/UserProfile/me', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bio: bioDraft.trim() || null,
          profilePicture: props.currentUser?.profilePicture || null,
          location: locationDraft.trim() || null,
          locationPrivacy: locationPrivacyDraft,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "We couldn't find that location. Try entering city and country.");
      }

      const profileResponse = await fetch('/api/UserProfile/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const savedProfile = profileResponse.ok ? await profileResponse.json() : null;
      const savedLocation =
        savedProfile?.locationDisplayName ||
        savedProfile?.location ||
        (locationPrivacyDraft === 'Hidden' ? 'Location hidden' : locationDraft.trim());

      setProfileLocation(savedLocation);
      setProfileBio(bioDraft.trim());
      setProfileLocationPrivacy(locationPrivacyDraft);
      setProfileSuccess(`Location saved as ${savedLocation || 'your profile location'}.`);
      setLocationSuggestions([]);
      window.dispatchEvent(new Event('tokenChanged'));
    } catch (err) {
      setProfileError(err.message || "We couldn't find that location. Try entering city and country.");
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="page-fade-in profile">
      <header className="profile__header">
        <div className="profile__header-mesh" aria-hidden="true" />
        <div className="profile__header-inner">
          <div className="profile__identity">
            <div className="profile__avatar-wrap">
              <div className="profile__avatar">{CURRENT_USER.initials}</div>
            </div>
            <div className="profile__identity-text">
              <h1>{props.currentUser.username}</h1>
              <p className="profile__username">@{props.currentUser.username}</p>
              <p className="profile__location">
                <MapPin size={14} />
                {profileLocation || 'Add location'}
              </p>
              {profileEditing && (
                <div className="profile__location-editor">
                  <div className="profile__editor-section">
                    <h4>Basic info</h4>
                    <label>
                      <span>About me</span>
                      <textarea
                        value={bioDraft}
                        onChange={(event) => setBioDraft(event.target.value)}
                        placeholder="Tell people a little about you"
                      />
                    </label>
                  </div>

                  <div className="profile__editor-section">
                    <h4>Location & privacy</h4>
                  <label>
                    <span>Location</span>
                    <input
                      type="text"
                      value={locationDraft}
                      onChange={handleLocationDraftChange}
                      placeholder="Enter your city or address"
                      autoComplete="off"
                    />
                    {(locationSuggestionsLoading || locationSuggestions.length > 0) && (
                      <div className="profile__location-suggestions">
                        {locationSuggestionsLoading && (
                          <span className="profile__location-suggestion-note">Finding places...</span>
                        )}
                        {!locationSuggestionsLoading && locationSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.locationInput}
                            type="button"
                            onClick={() => handleLocationSuggestionSelect(suggestion)}
                          >
                            <strong>{suggestion.displayName}</strong>
                            <span>{suggestion.locationInput}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </label>
                    <label>
                      <span>Privacy</span>
                      <select
                        value={locationPrivacyDraft}
                        onChange={(event) => setLocationPrivacyDraft(event.target.value)}
                      >
                        <option value="CityOnly">Show city only</option>
                        <option value="Hidden">Hide location</option>
                      </select>
                    </label>
                  <p>You can enter a city or address. Only your approximate location will be shown publicly. Exact coordinates are used privately for distance matching.</p>
                  </div>
                  {profileError && <span className="profile__location-error">{profileError}</span>}
                  {profileSuccess && <span className="profile__location-success">{profileSuccess}</span>}
                  <div className="profile__location-actions">
                    <button type="button" className="app-btn-pill" onClick={handleProfileSave} disabled={profileSaving}>
                      {profileSaving ? 'Finding location...' : 'Save'}
                    </button>
                    <button type="button" className="profile__quiet-btn" onClick={handleProfileCancel}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="profile__badges-row">
                <span className="glass-pill glass-pill--online">ACTIVE TODAY</span>
                <span className="profile__completion">{CURRENT_USER.completion}% complete</span>
                <span className="profile__type-badge">{CURRENT_USER.personalityType}</span>
              </div>
              <span className="profile__exploring">Currently Exploring</span>
              <div className="profile__trait-tags">
                {CURRENT_USER.badges.map((b) => (
                  <span key={b} className="profile__trait">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="profile__stat-grid">
            {statCards.map(({ icon: Icon, label, value }) => (
              <div key={label} className="profile__stat-card app-tilt-hover">
                <Icon size={18} />
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="profile__header-actions">
            <button
              type="button"
              className="app-btn-pill app-btn-pill--outline app-interactive"
              onClick={handleProfileEdit}
            >
              EDIT PROFILE
            </button>
            <button type="button" className="profile__logout" onClick={handleLogout}>
              LOGOUT
            </button>
          </div>
        </div>
      </header>

      <div className="profile__body">
        <div className="profile__tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`profile__tab${tab === t ? ' profile__tab--active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
              {tab === t && <span className="profile__tab-glow" />}
            </button>
          ))}
        </div>

        <div key={tab} className="profile__tab-panel">
          {tab === 'ABOUT' && (
            <div className="profile__about">
              <section className="profile__block">
                <h3>About Me</h3>
                <textarea
                  readOnly
                  value={profileBio || 'Add a short bio from Edit Profile.'}
                />
              </section>

              <section className="profile__block profile__little-things">
                <h3>LITTLE THINGS ABOUT ME</h3>
                <div className="profile__little-grid">
                  {LITTLE_THINGS.map((item) => (
                    <span key={item} className="profile__little-card app-tilt-hover">
                      {item}
                    </span>
                  ))}
                </div>
              </section>

              <div className="profile__mini-grid">
                <section className="profile__mini-card">
                  <h4>
                    <Music size={14} />
                    Favorite Activities
                  </h4>
                  <div className="profile__pills">
                    {ACTIVITIES.map((a) => (
                      <span key={a} className="profile__pill">
                        {a}
                      </span>
                    ))}
                  </div>
                </section>
                <section className="profile__mini-card">
                  <h4>Social Energy</h4>
                  <div className="profile__energy-ring">
                    <svg viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" className="profile__ring-bg" />
                      <circle
                        cx="18"
                        cy="18"
                        r="15"
                        className="profile__ring-fill"
                        style={{ strokeDashoffset: 94 * (1 - SOCIAL_ENERGY / 100) }}
                      />
                    </svg>
                    <span>{SOCIAL_ENERGY}%</span>
                  </div>
                </section>
                <section className="profile__mini-card">
                  <h4>
                    <Coffee size={14} />
                    Conversation Style
                  </h4>
                  <p>{CONVERSATION}</p>
                </section>
                <section className="profile__mini-card">
                  <h4>
                    <Moon size={14} />
                    Looking For
                  </h4>
                  <div className="profile__pills">
                    {['Meaningful connection', 'Adventure partner', 'Creative collaborator'].map(
                      (item) => (
                        <span key={item} className="profile__pill">
                          {item}
                        </span>
                      ),
                    )}
                  </div>
                </section>
              </div>

              <DeepPreferencesSection />
              <AvailabilityScheduleEditor />
            </div>
          )}

          {tab === 'MATCHES' && (
            <div className="profile__matches-grid">
              {matches.slice(0, 6).map((m) => (
                <article key={m.id} className="profile__match-card app-tilt-hover">
                  <div className="profile__match-ring">
                    <div className="profile__match-avatar">{m.initials}</div>
                    <span className="profile__match-score">{m.compatibility}%</span>
                  </div>
                  <h4>{m.name}</h4>
                  <p className="profile__match-loc">{m.location}</p>
                  <div className="profile__match-interests">
                    {m.interests.slice(0, 2).map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <span className="profile__match-online">Recently active</span>
                  <button type="button" className="app-btn-pill profile__match-view app-interactive">
                    VIEW
                  </button>
                </article>
              ))}
            </div>
          )}

          {tab === 'EVENTS' && (
            <div className="profile__events-panel">
              <div className="profile__event-segment">
                {EVENT_SEGMENTS.map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    className={eventSegment === seg ? 'profile__event-seg--active' : ''}
                    onClick={() => setEventSegment(seg)}
                  >
                    {seg}
                  </button>
                ))}
              </div>
              <div className="profile__events-list">
                {eventLists[eventSegment].map((e) => (
                  <EventCard key={e.id} event={e} mini />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Profile;
