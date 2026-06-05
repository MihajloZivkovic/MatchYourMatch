import { useState } from "react";
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
import { suggestedConnections } from "../../data/matches";
import { events } from "../../data/events";
import "./Dashboard.css";

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

function Dashboard(props) {
  const [interests, setInterests] = useState(DEFAULT_INTERESTS);
  const [vibe, setVibe] = useState(DEFAULT_VIBE);

  const toggleInterest = (pill) => {
    setInterests((prev) =>
      prev.includes(pill) ? prev.filter((p) => p !== pill) : [...prev, pill],
    );
  };

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
          <p className="dashboard__welcome">WELCOME BACK,</p>
          <h1 className="dashboard__name">{props.currentUser.username}</h1>
          <p className="dashboard__subtext">
            Your next meaningful connection might already be here.
          </p>
          <span className="glass-pill glass-pill--online">ONLINE</span>
          <div className="dashboard__quick-actions">
            <Link
              to="/app/quick-match"
              className="dashboard__action app-interactive app-tilt-hover"
            >
              <Zap size={18} />
              <span>QUICK MATCH</span>
            </Link>
            <Link
              to="/app/deep-match"
              className="dashboard__action app-interactive app-tilt-hover"
            >
              <Brain size={18} />
              <span>DEEP MATCH</span>
            </Link>
            <Link
              to="/app/events"
              className="dashboard__action app-interactive app-tilt-hover"
            >
              <Calendar size={18} />
              <span>EXPLORE EVENTS</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Section 2 — How Matching Works */}
      <section className="dashboard__section">
        <h2 className="app-section-title">HOW MATCHING WORKS</h2>
        <p className="dashboard__section-desc">
          Two paths. One platform. Choose how you want to connect today.
        </p>
        <div className="dashboard__match-types">
          <Link
            to="/app/quick-match"
            className="dashboard__type-card app-tilt-hover"
          >
            <div className="dashboard__type-icon">
              <Zap size={28} />
            </div>
            <h3>QUICK MATCH</h3>
            <p>
              Fast, instinctive, energy-based matching. Trust your gut and meet
              people who feel right in the moment.
            </p>
            <div className="dashboard__type-tags">
              <span>FAST</span>
              <span>CASUAL</span>
              <span>INSTANT CONNECTION</span>
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
            <h3>DEEP MATCH</h3>
            <p>
              Deeper personality alignment and intentional matching built on
              values, lifestyle, and long-term compatibility.
            </p>
            <div className="dashboard__type-tags">
              <span>PERSONALITY</span>
              <span>VALUES</span>
              <span>LONG-TERM</span>
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
        <h2 className="app-section-title">YOUR PREFERENCES</h2>
        <p className="dashboard__section-desc">
          Tap what feels like you — we&apos;ll surface people and moments that
          match your vibe.
        </p>
        <div className="dashboard__prefs-card">
          <h4>What are you into?</h4>
          <div className="dashboard__pref-grid">
            {INTEREST_PILLS.map((pill) => (
              <button
                key={pill}
                type="button"
                className={`dashboard__pref-pill app-pill-select${interests.includes(pill) ? " dashboard__pref-pill--on" : ""}`}
                onClick={() => toggleInterest(pill)}
              >
                {pill}
              </button>
            ))}
          </div>

          <h4>Your vibe</h4>
          <div className="dashboard__vibe-row">
            {VIBE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                className={`dashboard__vibe-pill app-pill-select${vibe === option ? " dashboard__vibe-pill--on" : ""}`}
                onClick={() => setVibe(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Section 4 — Suggested Connections */}
      <section className="dashboard__section">
        <h2 className="app-section-title">SUGGESTED CONNECTIONS</h2>
        <p className="dashboard__section-desc">
          Profiles aligned with your energy and interests.
        </p>
        <div className="dashboard__feed">
          {suggestedConnections.map((person, i) => (
            <article
              key={person.id}
              className="dashboard__connection app-tilt-hover"
              style={{ "--i": i }}
            >
              <div
                className={`dashboard__conn-avatar${person.online ? " dashboard__conn-avatar--live" : ""}`}
              >
                {person.initials}
              </div>
              <div className="dashboard__conn-body">
                <div className="dashboard__conn-head">
                  <h3>{person.name}</h3>
                  <span className="dashboard__conn-compat">
                    {person.compatibility}%
                  </span>
                  {person.online && (
                    <span className="dashboard__conn-online">Online</span>
                  )}
                </div>
                <p className="dashboard__conn-bio">{person.bio}</p>
                <div className="dashboard__conn-mutual">
                  {person.mutualInterests.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </div>
              <div className="dashboard__conn-actions">
                <button
                  type="button"
                  className="dashboard__conn-btn app-interactive"
                  aria-label="Message"
                >
                  <MessageCircle size={16} />
                </button>
                <button
                  type="button"
                  className="dashboard__conn-btn dashboard__conn-btn--match app-interactive"
                  aria-label="Match"
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
          <h2 className="app-section-title">EVENTS FOR YOU</h2>
          <Link
            to="/app/events"
            className="dashboard__view-all app-interactive"
          >
            VIEW ALL EVENTS
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
                {event.attendeeCount} attending
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
