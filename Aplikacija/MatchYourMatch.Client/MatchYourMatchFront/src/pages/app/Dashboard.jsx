import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Zap,
  Brain,
  Calendar,
  Heart,
  MessageCircle,
  ChevronRight,
  Users,
} from "lucide-react";
import { events } from "../../data/events";
import "./Dashboard.css";
import { useTranslation } from '../../hooks/useTranslation';

const INTEREST_PILLS = [
  "Late Night Drives",
  "Coffee Dates",
  "Gaming",
  "Music",
  "Gym",
  "Design",
  "Fashion",
  "Photography",
  "Art",
  "Tech",
  "Travel",
  "Anime",
  "Nature",
  "Festivals",
];

const VIBE_OPTIONS = [
  "Chill",
  "Adventurous",
  "Creative",
  "Social",
  "Deep Thinker",
  "Spontaneous",
];

const DEFAULT_INTERESTS = ["Music", "Coffee Dates", "Design", "Travel"];
const DEFAULT_VIBE = "Creative";
const NO_BIO_TEXT = "No bio added yet.";

function getMatchName(match) {
  return match.displayName || match.username || "MYM user";
}

function getInitials(value) {
  const source = value || "MY";
  const parts = source.trim().split(/[\s._-]+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return source.trim().slice(0, 2).toUpperCase() || "MY";
}

function getMatchTags(match) {
  return [
    ...(match.sharedActivities || []),
    ...(match.sharedInterests || []),
    ...(match.reasons || []),
  ]
    .filter(Boolean)
    .slice(0, 4);
}

function mapDeepMatchToConnection(match) {
  const name = getMatchName(match);

  return {
    id: match.userId,
    username: match.username || name,
    name,
    initials: match.initials || getInitials(name),
    compatibility: Number(match.compatibilityScore) || 0,
    bio: match.about || NO_BIO_TEXT,
    location: match.location,
    tags: getMatchTags(match),
  };
}

function Dashboard(props) {
  const { t } = useTranslation();
  const [interests, setInterests] = useState(DEFAULT_INTERESTS);
  const [vibe, setVibe] = useState(DEFAULT_VIBE);
  const [suggestedConnections, setSuggestedConnections] = useState([]);
  const [suggestedStatus, setSuggestedStatus] = useState("loading");
  const [suggestedMessage, setSuggestedMessage] = useState("");

  const toggleInterest = (pill) => {
    setInterests((prev) =>
      prev.includes(pill) ? prev.filter((p) => p !== pill) : [...prev, pill],
    );
  };

  useEffect(() => {
    let mounted = true;

    const loadSuggestedConnections = async () => {
      setSuggestedStatus("loading");
      setSuggestedMessage("");

      try {
        const token = localStorage.getItem("token");

        if (!token) {
          throw new Error("Please log in again.");
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [preferencesResponse, availabilityResponse] = await Promise.all([
          fetch("/api/UserProfile/me/deep-preferences", { headers }),
          fetch("/api/UserProfile/me/availability", { headers }),
        ]);

        if (
          preferencesResponse.status === 401 ||
          preferencesResponse.status === 403 ||
          availabilityResponse.status === 401 ||
          availabilityResponse.status === 403
        ) {
          throw new Error("Please log in again.");
        }

        if (!preferencesResponse.ok || !availabilityResponse.ok) {
          throw new Error("Suggested connections could not be loaded.");
        }

        const preferencesData = await preferencesResponse.json();
        const availabilityData = await availabilityResponse.json();

        if (!preferencesData.isComplete || availabilityData.length === 0) {
          if (mounted) {
            setSuggestedConnections([]);
            setSuggestedStatus("incomplete");
            setSuggestedMessage(
              "No suggested connections yet. Complete your Deep Match preferences to get better matches.",
            );
          }
          return;
        }

        const matchesResponse = await fetch("/api/DeepMatch/matches", { headers });

        if (matchesResponse.status === 401 || matchesResponse.status === 403) {
          throw new Error("Please log in again.");
        }

        if (!matchesResponse.ok) {
          const body = await matchesResponse.text();
          throw new Error(body || "Suggested connections could not be loaded.");
        }

        const matchesData = await matchesResponse.json();
        const connections = matchesData
          .map(mapDeepMatchToConnection)
          .sort((first, second) => second.compatibility - first.compatibility)
          .slice(0, 5);

        if (mounted) {
          setSuggestedConnections(connections);
          setSuggestedStatus(connections.length > 0 ? "ready" : "empty");
          setSuggestedMessage(
            connections.length > 0
              ? ""
              : "No suggested connections yet. Complete your Deep Match preferences to get better matches.",
          );
        }
      } catch (err) {
        if (mounted) {
          setSuggestedConnections([]);
          setSuggestedStatus("error");
          setSuggestedMessage(err.message || "Suggested connections could not be loaded.");
        }
      }
    };

    loadSuggestedConnections();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="page-fade-in dashboard">
      {/* Section 1 — Hero */}
      <section className="dashboard__hero">
        <div className="dashboard__hero-bg" aria-hidden="true">
          <span className="dashboard__orb dashboard__orb--1" />
          <span className="dashboard__orb dashboard__orb--2" />
          <span className="dashboard__vignette" />
        </div>
        <div className="dashboard__hero-content">
          <p className="dashboard__welcome">{t('dashboard.welcome').toUpperCase()}</p>
          <h1 className="dashboard__name">{props.currentUser.username}</h1>
          <p className="dashboard__subtext">
            {t('dashboard.subtitle')}
          </p>
          <span className="glass-pill glass-pill--online">{t('dashboard.online').toUpperCase()}</span>
          <div className="dashboard__quick-actions">
            <Link
              to="/app/quick-match"
              className="dashboard__action app-interactive app-tilt-hover"
            >
              <Zap size={18} />
              <span>{t('nav.quickMatch').toUpperCase()}</span>
            </Link>
            <Link
              to="/app/deep-match"
              className="dashboard__action app-interactive app-tilt-hover"
            >
              <Brain size={18} />
              <span>{t('nav.deepMatch').toUpperCase()}</span>
            </Link>
            <Link
              to="/app/events"
              className="dashboard__action app-interactive app-tilt-hover"
            >
              <Calendar size={18} />
              <span>{t('dashboard.exploreEvents').toUpperCase()}</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Section 2 — How Matching Works */}
      <section className="dashboard__section">
        <h2 className="app-section-title">{t('dashboard.howWorks').toUpperCase()}</h2>
        <p className="dashboard__section-desc">
          {t('dashboard.howWorksText')}
        </p>
        <div className="dashboard__match-types">
          <Link
            to="/app/quick-match"
            className="dashboard__type-card app-tilt-hover"
          >
            <div className="dashboard__type-icon">
              <Zap size={28} />
            </div>
            <h3>{t('nav.quickMatch').toUpperCase()}</h3>
            <p>{t('dashboard.quickText')}</p>
            <div className="dashboard__type-tags">
              <span>{t('dashboard.fast').toUpperCase()}</span>
              <span>{t('dashboard.casual').toUpperCase()}</span>
              <span>{t('dashboard.instant').toUpperCase()}</span>
            </div>
            <div className="dashboard__swipe-mock" aria-hidden="true">
              <span className="dashboard__swipe-card dashboard__swipe-card--back" />
              <span className="dashboard__swipe-card dashboard__swipe-card--front">
                <small>94%</small>
              </span>
            </div>
          </Link>

          <Link
            to="/app/deep-match"
            className="dashboard__type-card dashboard__type-card--deep app-tilt-hover"
          >
            <div className="dashboard__type-icon dashboard__type-icon--deep">
              <Brain size={28} />
            </div>
            <h3>{t('nav.deepMatch').toUpperCase()}</h3>
            <p>{t('dashboard.deepText')}</p>
            <div className="dashboard__type-tags">
              <span>{t('dashboard.personality').toUpperCase()}</span>
              <span>{t('dashboard.values').toUpperCase()}</span>
              <span>{t('dashboard.longTerm').toUpperCase()}</span>
            </div>
            <div className="dashboard__graph-mock">
              {[88, 72, 95, 64].map((v, i) => (
                <div key={i} className="dashboard__graph-bar">
                  <span style={{ "--h": `${v}%` }} />
                  <small>{v}%</small>
                </div>
              ))}
            </div>
          </Link>
        </div>
      </section>

      {/* Section 3 — Preferences */}
      <section className="dashboard__section dashboard__prefs">
        <h2 className="app-section-title">{t('dashboard.preferences').toUpperCase()}</h2>
        <p className="dashboard__section-desc">{t('dashboard.preferencesText')}</p>
        <div className="dashboard__prefs-card">
          <h4>{t('dashboard.into')}</h4>
          <div className="dashboard__pref-grid">
            {INTEREST_PILLS.map((pill) => (
              <button
                key={pill}
                type="button"
                className={`dashboard__pref-pill app-pill-select${interests.includes(pill) ? " dashboard__pref-pill--on" : ""}`}
                onClick={() => toggleInterest(pill)}
              >
                {t(`dashboardOptions.${pill}`)}
              </button>
            ))}
          </div>

          <h4>{t('dashboard.vibe')}</h4>
          <div className="dashboard__vibe-row">
            {VIBE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`dashboard__vibe-pill app-pill-select${vibe === option ? " dashboard__vibe-pill--on" : ""}`}
                onClick={() => setVibe(option)}
              >
                {t(`dashboardOptions.${option}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — Suggested Connections */}
      <section className="dashboard__section">
        <h2 className="app-section-title">{t('dashboard.suggested').toUpperCase()}</h2>
        <p className="dashboard__section-desc">
          {t('dashboard.suggestedText')}
        </p>
        <div className="dashboard__feed">
          {suggestedStatus === "loading" && (
            <div className="dashboard__connections-state">
              {t('dashboard.loadingSuggested')}
            </div>
          )}

          {suggestedStatus === "incomplete" && (
            <div className="dashboard__connections-state">
              <p>{suggestedMessage}</p>
              <Link to="/app/profile" className="dashboard__state-link app-interactive">
                {t('dashboard.editProfile')}
              </Link>
            </div>
          )}

          {suggestedStatus === "empty" && (
            <div className="dashboard__connections-state">
              {suggestedMessage}
            </div>
          )}

          {suggestedStatus === "error" && (
            <div className="dashboard__connections-state dashboard__connections-state--error">
              {suggestedMessage}
            </div>
          )}

          {suggestedStatus === "ready" && suggestedConnections.map((person, i) => (
            <article
              key={person.id}
              className="dashboard__connection app-tilt-hover"
              style={{ "--i": i }}
            >
              <div className="dashboard__conn-avatar">
                {person.initials}
              </div>
              <div className="dashboard__conn-body">
                <div className="dashboard__conn-head">
                  <Link to={`/app/users/${person.id}`} className="dashboard__conn-name">
                    {person.name}
                  </Link>
                  <span className="dashboard__conn-compat">
                    {person.compatibility}%
                  </span>
                </div>
                <p className="dashboard__conn-bio">{person.bio}</p>
                <div className="dashboard__conn-mutual">
                  {person.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <div className="dashboard__conn-actions">
                <Link
                  to={`/app/chat?userId=${person.id}&username=${encodeURIComponent(person.username)}`}
                  className="dashboard__conn-btn app-interactive"
                  aria-label="Message"
                >
                  <MessageCircle size={16} />
                </Link>
                <button
                  type="button"
                  className="dashboard__conn-btn dashboard__conn-btn--match app-interactive"
                  aria-label="Like unavailable"
                  disabled
                >
                  <Heart size={16} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Section 5 — Event Recommendations */}
      <section className="dashboard__section dashboard__events-section">
        <div className="dashboard__events-head">
          <h2 className="app-section-title">{t('dashboard.eventsForYou').toUpperCase()}</h2>
          <Link
            to="/app/events"
            className="dashboard__view-all app-interactive"
          >
            {t('dashboard.viewAll').toUpperCase()}
            <ChevronRight size={16} />
          </Link>
        </div>
        <div className="dashboard__events-carousel">
          {events.slice(0, 5).map((event, i) => (
            <article
              key={event.id}
              className="dashboard__event-mini app-tilt-hover"
              style={{ "--i": i }}
            >
              <span className="dashboard__event-cat">{event.category}</span>
              <h4>{event.title}</h4>
              <p className="dashboard__event-meta">
                <Users size={12} />
                {t('dashboard.attending', { count: event.attendeeCount })}
              </p>
              <span className="dashboard__event-date">{event.date}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Dashboard;
