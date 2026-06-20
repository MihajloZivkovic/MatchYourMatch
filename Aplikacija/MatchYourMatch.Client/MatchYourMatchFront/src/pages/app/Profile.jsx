import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Heart,
  Calendar,
  Star,
  MessageCircle,
  Music,
  Coffee,
  Moon,
  RefreshCw,
  Send,
  Users,
} from "lucide-react";
import EventCard from "../../components/EventCard";
import AvailabilityScheduleEditor from "../../components/profile/AvailabilityScheduleEditor";
import DeepPreferencesSection from "../../components/profile/DeepPreferencesSection";
import { CURRENT_USER, LITTLE_THINGS } from "../../data/matches";
import "./Profile.css";

const TABS = ["ABOUT", "MATCHES", "EVENTS"];
const EVENT_SEGMENTS = ["Upcoming", "Past", "Saved"];

const ACTIVITIES = [
  "Live music",
  "Gallery nights",
  "Rooftop hangs",
  "Road trips",
];
const SOCIAL_ENERGY = 72;
const CONVERSATION = "Thoughtful & playful";

function Profile(props) {
  const { setUserProfile } = props;
  const [tab, setTab] = useState("ABOUT");
  const [eventSegment, setEventSegment] = useState("Upcoming");
  const [profileEditing, setProfileEditing] = useState(false);
  const [bio, setBio] = useState(props.userProfile.bio || "");
  const [bioDraft, setBioDraft] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [locationPrivacyDraft, setLocationPrivacyDraft] = useState("CityOnly");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileLocationPrivacy, setProfileLocationPrivacy] = useState("CityOnly");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSuggestionsLoading, setLocationSuggestionsLoading] = useState(false);
  const [saveButtonText, setSaveButtonText] = useState("Save");
  const [saveButtonAnimating, setSaveButtonAnimating] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [profileEvents, setProfileEvents] = useState({
    Upcoming: [],
    Past: [],
    Saved: [],
  });
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState("");
  const [profileMatches, setProfileMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const navigate = useNavigate();

  const styleButton = () => {
    setSaveButtonText("Saved!");
    setSaveButtonAnimating(true);

    window.setTimeout(() => {
      setSaveButtonText("Save");
      setSaveButtonAnimating(false);
    }, 2000);
  };

  useEffect(() => {
    const location =
      props.currentUser?.locationDisplayName || props.currentUser?.location || "";
    const locationInput = props.currentUser?.locationRawInput || location;
    const currentBio = props.currentUser?.bio || props.userProfile.bio || "";
    const privacy = props.currentUser?.locationPrivacy || "CityOnly";

    setProfileLocation(location);
    setLocationDraft(locationInput);
    setProfileBio(currentBio);
    setBio(currentBio);
    setBioDraft(currentBio);
    setProfileLocationPrivacy(privacy);
    setLocationPrivacyDraft(privacy);
  }, [
    props.currentUser?.bio,
    props.currentUser?.location,
    props.currentUser?.locationDisplayName,
    props.currentUser?.locationRawInput,
    props.currentUser?.locationPrivacy,
    props.userProfile.bio,
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
        const token = localStorage.getItem("token");
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
        if (err.name !== "AbortError") {
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

  const fetchProfile = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setProfileLoading(true);
    setProfileLoadError("");

    try {
      const response = await fetch("/api/UserProfile/me", {
        headers: {
          accept: "*/*",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || `Profile request failed (${response.status}).`);
      }

      const data = await response.json();
      setUserProfile((prev) => ({
        ...prev,
        bio: data.bio ?? prev.bio,
        location: data.location ?? prev.location,
        profilePicture: data.profilePicture ?? prev.profilePicture,
        matchesCount: data.matchesCount ?? null,
        eventsJoinedCount: data.eventsJoinedCount ?? null,
        profileScorePercent: data.profileScorePercent ?? null,
        responseRatePercent: data.responseRatePercent ?? null,
      }));
    } catch (error) {
      console.error("[Profile API] /api/UserProfile/me failed", {
        message: error.message,
      });
      setProfileLoadError(
        "Backend is not available. Please start the API server and try again.",
      );
    } finally {
      setProfileLoading(false);
    }
  }, [setUserProfile]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const fetchProfileEvents = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setEventsLoading(true);
    setEventsError("");

    try {
      const response = await fetch("/api/Events/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Events could not be loaded.");
      }

      const data = await response.json();
      const mapped = mapProfileEvents(data);
      setProfileEvents(mapped);
      const allProfileEvents = [
        ...mapped.Upcoming,
        ...mapped.Past,
        ...mapped.Saved,
      ];
      setSelectedEvent((current) =>
        current
          ? allProfileEvents.find((event) => event.id === current.id) || current
          : current,
      );
    } catch (error) {
      setEventsError(error.message || "Events could not be loaded.");
      setProfileEvents({
        Upcoming: [],
        Past: [],
        Saved: [],
      });
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfileEvents();
  }, [fetchProfileEvents]);

  const fetchProfileMatches = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) return;

    setMatchesLoading(true);
    setMatchesError("");

    try {
      const response = await fetch("/api/UserProfile/me/matches", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Please log in again.");
      }

      if (!response.ok) {
        throw new Error("Matches could not be loaded.");
      }

      const data = await response.json();
      const mapped = Array.isArray(data)
        ? data
            .map(mapConnectionToProfileMatch)
            .sort((first, second) => new Date(second.matchedAt) - new Date(first.matchedAt))
        : [];

      setProfileMatches(mapped);
    } catch (error) {
      setProfileMatches([]);
      setMatchesError(error.message || "Matches could not be loaded.");
    } finally {
      setMatchesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "MATCHES") {
      fetchProfileMatches();
    }
  }, [fetchProfileMatches, tab]);

  const handleLogout = () => {
    localStorage.removeItem("mym_authed");
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("tokenChanged"));
    navigate("/");
  };

  const updateProfile = async ({ nextBio, nextPicture, nextLocation, nextPrivacy }) => {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/UserProfile/me", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        bio: nextBio || null,
        profilePicture: nextPicture || null,
        location: nextLocation || null,
        locationPrivacy: nextPrivacy,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || "We couldn't save your profile right now.");
    }

    return response;
  };

  const sendImg = async (event) => {
    const img = event.target.files[0];
    if (!img) return;

    const convertToBase64 = (fileObj) =>
      new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsDataURL(fileObj);
        fileReader.onload = () => resolve(fileReader.result);
        fileReader.onerror = (error) => reject(error);
      });

    try {
      const convertedImage = await convertToBase64(img);
      await updateProfile({
        nextBio: profileBio || bio,
        nextPicture: convertedImage,
        nextLocation: props.currentUser?.locationRawInput || props.userProfile.location,
        nextPrivacy: profileLocationPrivacy,
      });

      props.setUserProfile((prev) => ({
        ...prev,
        profilePicture: convertedImage,
      }));
    } catch (error) {
      console.error("Failed to save profile image:", error);
    }
  };

  const handleProfileEdit = () => {
    setLocationDraft(props.currentUser?.locationRawInput || profileLocation);
    setBioDraft(profileBio);
    setLocationPrivacyDraft(profileLocationPrivacy);
    setProfileError("");
    setProfileSuccess("");
    setLocationSuggestions([]);
    setProfileEditing(true);
  };

  const handleProfileCancel = () => {
    setLocationDraft(props.currentUser?.locationRawInput || profileLocation);
    setBioDraft(profileBio);
    setLocationPrivacyDraft(profileLocationPrivacy);
    setProfileError("");
    setProfileSuccess("");
    setLocationSuggestions([]);
    setProfileEditing(false);
  };

  const handleLocationDraftChange = (event) => {
    setLocationDraft(event.target.value);
    setProfileSuccess("");
  };

  const handleLocationSuggestionSelect = (suggestion) => {
    setLocationDraft(suggestion.locationInput || suggestion.displayName);
    setProfileError("");
    setProfileSuccess("");
    setLocationSuggestions([]);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      await updateProfile({
        nextBio: bioDraft.trim(),
        nextPicture: props.userProfile.profilePicture,
        nextLocation: locationDraft.trim(),
        nextPrivacy: locationPrivacyDraft,
      });

      const token = localStorage.getItem("token");
      const profileResponse = await fetch("/api/UserProfile/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const savedProfile = profileResponse.ok ? await profileResponse.json() : null;
      const savedLocation =
        savedProfile?.locationDisplayName ||
        savedProfile?.location ||
        (locationPrivacyDraft === "Hidden" ? "Location hidden" : locationDraft.trim());

      setProfileLocation(savedLocation);
      setProfileBio(bioDraft.trim());
      setBio(bioDraft.trim());
      setProfileLocationPrivacy(locationPrivacyDraft);
      props.setUserProfile((prev) => ({
        ...prev,
        bio: bioDraft.trim(),
        location: savedProfile?.location ?? locationDraft.trim(),
        matchesCount: savedProfile?.matchesCount ?? prev.matchesCount,
        eventsJoinedCount: savedProfile?.eventsJoinedCount ?? prev.eventsJoinedCount,
        profileScorePercent: savedProfile?.profileScorePercent ?? prev.profileScorePercent,
        responseRatePercent: savedProfile?.responseRatePercent ?? prev.responseRatePercent,
      }));
      setProfileSuccess(`Location saved as ${savedLocation || "your profile location"}.`);
      setLocationSuggestions([]);
      styleButton();
      window.dispatchEvent(new Event("tokenChanged"));
    } catch (err) {
      setProfileError(
        err.message || "We couldn't find that location. Try entering city and country.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const handleBioSave = async (event) => {
    event.preventDefault();
    const bioText = bio.trim();

    try {
      await updateProfile({
        nextBio: bioText,
        nextPicture: props.userProfile.profilePicture,
        nextLocation: props.currentUser?.locationRawInput || props.userProfile.location,
        nextPrivacy: profileLocationPrivacy,
      });

      setProfileBio(bioText);
      setBioDraft(bioText);
      props.setUserProfile((prev) => ({
        ...prev,
        bio: bioText,
      }));
      styleButton();
      window.dispatchEvent(new Event("tokenChanged"));
    } catch (error) {
      console.error("Failed to save bio:", error);
    }
  };

  const responseRateValue =
    props.currentUser?.responseRatePercent ?? props.userProfile?.responseRatePercent;
  const responseRateDisplay =
    typeof responseRateValue === "number" ? `${responseRateValue}%` : "—";
  const matchesValue = props.currentUser?.matchesCount ?? props.userProfile?.matchesCount;
  const eventsJoinedValue =
    props.currentUser?.eventsJoinedCount ?? props.userProfile?.eventsJoinedCount;
  const profileScoreValue =
    props.currentUser?.profileScorePercent ?? props.userProfile?.profileScorePercent;
  const matchesDisplay = typeof matchesValue === "number" ? String(matchesValue) : "—";
  const eventsJoinedDisplay =
    typeof eventsJoinedValue === "number" ? String(eventsJoinedValue) : "—";
  const profileScoreDisplay =
    typeof profileScoreValue === "number" ? `${profileScoreValue}%` : "—";

  const statCards = [
    { icon: Heart, label: "Matches", value: matchesDisplay },
    { icon: Calendar, label: "Events Joined", value: eventsJoinedDisplay },
    { icon: Star, label: "Profile Score", value: profileScoreDisplay },
    { icon: MessageCircle, label: "Response Rate", value: responseRateDisplay },
  ];

  const eventLists = profileEvents;
  const eventEmptyCopy = {
    Upcoming: "No upcoming joined events.",
    Past: "No past events yet.",
    Saved: "No saved events yet.",
  };

  const handleJoinEvent = async (eventId) => {
    if (!isValidEventId(eventId)) {
      setEventsError("Event could not be joined because its database id is missing.");
      return;
    }

    try {
      const response = await fetch(`/api/Events/${eventId}/join`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(body || "Event could not be joined.");
      }

      const updated = mapApiEvent(await response.json());
      setSelectedEvent((current) => (current?.id === eventId ? updated : current));
      await fetchProfileEvents();
    } catch (error) {
      setEventsError(error.message || "Event could not be joined.");
    }
  };

  return (
    <div className="page-fade-in profile">
      <header className="profile__header">
        <div className="profile__header-mesh" aria-hidden="true" />
        <div className="profile__header-inner">
          <div className="profile__identity">
            <div className="profile__avatar-wrap">
              <div className="profile__avatar">
                <input
                  id="imgInput"
                  type="file"
                  accept="image/*"
                  onChange={sendImg}
                />
                {props.userProfile.profilePicture ? (
                  <img src={props.userProfile.profilePicture} alt="Profile" />
                ) : (
                  "+"
                )}
              </div>
            </div>
            <div className="profile__identity-text">
              <h1>{props.currentUser.username}</h1>
              <p className="profile__username">@{props.currentUser.username}</p>
              <p className="profile__location">
                <MapPin size={14} />
                {profileLocation || "Add location"}
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
                            <span className="profile__location-suggestion-note">
                              Finding places...
                            </span>
                          )}
                          {!locationSuggestionsLoading &&
                            locationSuggestions.map((suggestion) => (
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
                    <p>
                      You can enter a city or address. Only your approximate location will
                      be shown publicly. Exact coordinates are used privately for distance
                      matching.
                    </p>
                  </div>
                  {profileError && (
                    <span className="profile__location-error">{profileError}</span>
                  )}
                  {profileSuccess && (
                    <span className="profile__location-success">{profileSuccess}</span>
                  )}
                  <div className="profile__location-actions">
                    <button
                      type="button"
                      className={`app-btn-pill saveButton${
                        saveButtonAnimating ? " saveAnimation" : ""
                      }`}
                      onClick={handleProfileSave}
                      disabled={profileSaving}
                    >
                      {profileSaving ? "Finding location..." : saveButtonText}
                    </button>
                    <button
                      type="button"
                      className="profile__quiet-btn"
                      onClick={handleProfileCancel}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <div className="profile__badges-row">
                <span className="glass-pill glass-pill--online">ACTIVE TODAY</span>
                <span className="profile__completion">
                  {CURRENT_USER.completion}% complete
                </span>
                <span className="profile__type-badge">
                  {CURRENT_USER.personalityType}
                </span>
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
          {profileLoadError && (
            <div className="profile__api-error">
              <span>{profileLoadError}</span>
              <button type="button" onClick={fetchProfile} disabled={profileLoading}>
                {profileLoading ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

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
              className={`profile__tab${tab === t ? " profile__tab--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t}
              {tab === t && <span className="profile__tab-glow" />}
            </button>
          ))}
        </div>

        <div key={tab} className="profile__tab-panel">
          {tab === "ABOUT" && (
            <div className="profile__about">
              <form className="profile__block" onSubmit={handleBioSave}>
                <h3>About Me</h3>
                <textarea
                  name="bio"
                  placeholder="Designer and music lover based in Brooklyn. Always up for a rooftop sunset, live jazz, or a spontaneous road trip. Looking for genuine connection and good conversation."
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                />
                <button
                  type="submit"
                  className={`saveButton${saveButtonAnimating ? " saveAnimation" : ""}`}
                >
                  {saveButtonText}
                </button>
              </form>

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
                        style={{
                          strokeDashoffset: 94 * (1 - SOCIAL_ENERGY / 100),
                        }}
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
                    {[
                      "Meaningful connection",
                      "Adventure partner",
                      "Creative collaborator",
                    ].map((item) => (
                      <span key={item} className="profile__pill">
                        {item}
                      </span>
                    ))}
                  </div>
                </section>
              </div>

              <DeepPreferencesSection />
              <AvailabilityScheduleEditor />
            </div>
          )}

          {tab === "MATCHES" && (
            <div className="profile__matches-grid">
              {matchesLoading && (
                <div className="profile__matches-state">Loading matches...</div>
              )}

              {!matchesLoading && matchesError && (
                <div className="profile__matches-state profile__matches-state--error">
                  Matches could not be loaded.
                </div>
              )}

              {!matchesLoading && !matchesError && profileMatches.length === 0 && (
                <div className="profile__matches-state">
                  No matches yet. Try Quick Match or Deep Match to start connecting.
                </div>
              )}

              {!matchesLoading &&
                !matchesError &&
                profileMatches.map((m) => (
                  <article key={m.id} className="profile__match-card app-tilt-hover">
                    <div className="profile__match-ring">
                      <div className="profile__match-avatar">{m.initials}</div>
                      <span className="profile__match-score">{m.scoreLabel}</span>
                    </div>
                    <h4>{m.name}</h4>
                    <p className="profile__match-loc">{m.location}</p>
                    <div className="profile__match-interests">
                      {m.interests.length > 0 ? (
                        <>
                          {m.interests.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                          {m.extraInterestsCount > 0 && (
                            <span>+{m.extraInterestsCount} more</span>
                          )}
                        </>
                      ) : (
                        <em>Matched connection</em>
                      )}
                    </div>
                    {m.isRecentlyActive && (
                      <span className="profile__match-online">Recently active</span>
                    )}
                    <button
                      type="button"
                      className="app-btn-pill profile__match-view app-interactive"
                      onClick={() => navigate(`/app/users/${m.id}`)}
                    >
                      VIEW
                    </button>
                  </article>
                ))}
            </div>
          )}

          {tab === "EVENTS" && (
            <div className="profile__events-panel">
              {selectedEvent ? (
                <EventDetails
                  event={selectedEvent}
                  onBack={() => setSelectedEvent(null)}
                  onJoin={() => handleJoinEvent(selectedEvent.id)}
                />
              ) : (
                <>
                  <div className="profile__event-toolbar">
                    <div className="profile__event-segment">
                      {EVENT_SEGMENTS.map((seg) => (
                        <button
                          key={seg}
                          type="button"
                          className={
                            eventSegment === seg ? "profile__event-seg--active" : ""
                          }
                          onClick={() => setEventSegment(seg)}
                        >
                          {seg}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="profile__event-refresh"
                      onClick={fetchProfileEvents}
                      disabled={eventsLoading}
                      aria-label="Refresh events"
                      aria-busy={eventsLoading}
                      title="Refresh"
                    >
                      <RefreshCw size={18} aria-hidden="true" />
                    </button>
                  </div>

                  {eventsError && (
                    <div className="profile__events-error">
                      <span>{eventsError}</span>
                      <button type="button" onClick={fetchProfileEvents}>
                        Retry
                      </button>
                    </div>
                  )}

                  {!eventsLoading && !eventsError && eventLists[eventSegment].length === 0 && (
                    <div className="profile__events-empty">
                      {eventEmptyCopy[eventSegment]}
                    </div>
                  )}

                  <div className="profile__events-grid">
                    {eventLists[eventSegment].map((event, index) => (
                      <EventCard
                        key={event.id}
                        event={event}
                        style={{ "--i": index }}
                        onOpen={() => setSelectedEvent(event)}
                        onJoin={() => handleJoinEvent(event.id)}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventDetails({ event, onBack, onJoin }) {
  return (
    <section className="profile__event-detail">
      <button type="button" className="profile__event-back" onClick={onBack}>
        <ArrowLeft size={16} />
        Events
      </button>
      <div className="profile__event-detail-head">
        <span className="event-card__category">{event.category}</span>
        <h2>{event.title}</h2>
        <p>{event.description}</p>
        <div className="profile__event-detail-meta">
          <span>
            <Calendar size={15} />
            {event.date} at {event.time}
          </span>
          <span>
            <MapPin size={15} />
            {event.location}
          </span>
          <span>
            <Users size={15} />
            {event.attendeeCount}/{event.maxAttendees || "open"} attending
          </span>
        </div>
        <div className="profile__event-detail-actions">
          <button
            type="button"
            className={`event-card__join${
              event.isJoinedByCurrentUser ? " event-card__join--joined" : ""
            }`}
            onClick={onJoin}
            disabled={event.isJoinedByCurrentUser}
          >
            {event.isJoinedByCurrentUser ? "JOINED" : "JOIN EVENT"}
          </button>
          {event.organizerUsername && (
            <span>Hosted by @{event.organizerUsername}</span>
          )}
        </div>
      </div>

      <EventDiscussion event={event} onJoin={onJoin} />
    </section>
  );
}

function EventDiscussion({ event, onJoin }) {
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef(null);

  const loadDiscussion = useCallback(async () => {
    const eventId = Number(event.id);

    if (!isValidEventId(eventId)) {
      setMessages([]);
      setError("Event discussion could not be loaded because the event database id is missing.");
      return;
    }

    if (!event.isJoinedByCurrentUser) {
      setMessages([]);
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/Events/${eventId}/discussion`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(getDiscussionErrorMessage(response.status, body));
      }

      const data = await response.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (loadError) {
      console.error("[Event Discussion] load failed", loadError);
      setError(loadError.message || "Event discussion could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [event.id, event.isJoinedByCurrentUser]);

  useEffect(() => {
    loadDiscussion();
  }, [loadDiscussion]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async (submitEvent) => {
    submitEvent.preventDefault();
    const eventId = Number(event.id);
    const body = draft.trim();
    if (!body || sending) return;

    if (!isValidEventId(eventId)) {
      setError("Message could not be sent because the event database id is missing.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await fetch(`/api/Events/${eventId}/discussion`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          body,
        }),
      });

      if (!response.ok) {
        const responseBody = await response.text();
        throw new Error(getDiscussionErrorMessage(response.status, responseBody));
      }

      const sent = await response.json();
      setMessages((current) => [...current, sent]);
      setDraft("");
    } catch (sendError) {
      console.error("[Event Discussion] send failed", sendError);
      setError(sendError.message || "Message could not be sent.");
    } finally {
      setSending(false);
    }
  };

  if (!event.isJoinedByCurrentUser) {
    return (
      <section className="profile__event-thread profile__event-thread--locked">
        <h3>Event discussion</h3>
        <p>Join this event to see and write in its private discussion.</p>
        <button type="button" className="app-btn-pill" onClick={onJoin}>
          Join to discuss
        </button>
      </section>
    );
  }

  return (
    <section className="profile__event-thread">
      <div className="profile__event-thread-head">
        <div>
          <h3>Event discussion</h3>
          <p>Messages stay attached to this event only.</p>
        </div>
        <button type="button" className="profile__quiet-btn" onClick={loadDiscussion}>
          Refresh
        </button>
      </div>

      {loading && <div className="profile__events-empty">Loading discussion...</div>}
      {error && <div className="profile__events-error">{error}</div>}

      <div className="profile__event-messages" ref={messagesRef}>
        {!loading && messages.length === 0 && (
          <div className="profile__events-empty">No messages yet.</div>
        )}
        {messages.map((message) => {
          const mine = Boolean(message.isMine);

          return (
            <div
              key={message.id}
              className={`profile__event-message${
                mine ? " profile__event-message--mine" : ""
              }`}
            >
              {!mine && (
                <span>{message.displayName || message.username || "Member"}</span>
              )}
              <p>
                {message.isDeleted ? "This message was deleted" : message.body}
              </p>
              <small>{formatChatTime(message.createdAt)}</small>
            </div>
          );
        })}
      </div>

      <form className="profile__event-composer" onSubmit={handleSend}>
        <input
          value={draft}
          onChange={(inputEvent) => setDraft(inputEvent.target.value)}
          placeholder="Write in event discussion..."
          maxLength={2000}
        />
        <button type="submit" disabled={sending || !draft.trim()} aria-label="Send">
          <Send size={17} />
        </button>
      </form>
    </section>
  );
}

function mapApiEvent(event) {
  const id = event.id ?? event.Id;

  return {
    id,
    title: event.title ?? event.Title ?? "Untitled event",
    category: normalizeCategory(event.category ?? event.Category),
    date: formatEventDate(event.date ?? event.Date),
    rawDate: event.date ?? event.Date,
    time: formatEventTime(event.time ?? event.Time),
    rawTime: event.time ?? event.Time,
    location: event.location ?? event.Location ?? "Community meetup",
    description:
      event.description ?? event.Description ?? "Community event created by a MYM user.",
    attendees: event.participantInitials ?? event.ParticipantInitials ?? [],
    attendeeCount: event.participantsCount ?? event.ParticipantsCount ?? 0,
    maxAttendees: event.maxAttendees ?? event.MaxAttendees ?? 0,
    isJoinedByCurrentUser: Boolean(
      event.isJoinedByCurrentUser ?? event.IsJoinedByCurrentUser,
    ),
    organizerUsername: event.organizerUsername ?? event.OrganizerUsername,
  };
}

function mapProfileEvents(data) {
  return {
    Upcoming: mapEventGroup(data?.upcoming ?? data?.Upcoming),
    Past: mapEventGroup(data?.past ?? data?.Past),
    Saved: mapEventGroup(data?.saved ?? data?.Saved),
  };
}

function mapEventGroup(events) {
  return Array.isArray(events) ? events.map(mapApiEvent) : [];
}

function mapConnectionToProfileMatch(match) {
  const name = getMatchName(match);
  const tags = getMatchTags(match);
  const visibleTags = tags.slice(0, 3);
  const compatibilityScore = match.compatibilityScore ?? match.CompatibilityScore ?? null;

  return {
    id: match.userId ?? match.UserId,
    username: match.username ?? match.Username ?? name,
    name,
    initials: match.initials ?? match.Initials ?? getInitials(name),
    compatibility: compatibilityScore == null ? null : Number(compatibilityScore) || 0,
    scoreLabel: compatibilityScore == null ? "Matched" : `${Number(compatibilityScore) || 0}%`,
    location:
      match.location ??
      match.Location ??
      match.locationDisplayName ??
      match.LocationDisplayName ??
      match.approximateDistanceLabel ??
      match.ApproximateDistanceLabel ??
      "Location not set",
    interests: visibleTags,
    extraInterestsCount: Math.max(0, tags.length - visibleTags.length),
    matchedAt: match.matchedAt ?? match.MatchedAt ?? null,
    isRecentlyActive: Boolean(match.isRecentlyActive ?? match.IsRecentlyActive ?? match.activeToday),
  };
}

function getMatchName(match) {
  return (
    match.displayName ??
    match.DisplayName ??
    match.username ??
    match.Username ??
    "MYM member"
  );
}

function getMatchTags(match) {
  return [
    ...(match.sharedInterests ?? match.SharedInterests ?? []),
    ...(match.sharedActivities ?? match.SharedActivities ?? []),
    ...(match.reasons ?? match.Reasons ?? []),
  ].filter(Boolean);
}

function getInitials(value) {
  const source = String(value || "").trim();
  if (!source) return "MY";

  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function normalizeCategory(category) {
  return (category || "Social").trim().toUpperCase();
}

function formatEventDate(value) {
  if (!value) return "Date TBA";
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatEventTime(value) {
  if (!value) return "Time TBA";
  const [hours = "00", minutes = "00"] = value.split(":");
  const date = new Date();
  date.setHours(Number(hours), Number(minutes), 0, 0);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatChatTime(value) {
  if (!value) return "";
  const date =
    typeof value === "string" && !/[zZ]|[+-]\d{2}:\d{2}$/.test(value)
      ? new Date(`${value}Z`)
      : new Date(value);

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDiscussionErrorMessage(status, body) {
  if (status === 404) return "Event discussion could not be loaded. Event was not found.";
  if (status === 403) return "Join the event to open its discussion.";
  if (status === 401) return "Discussion request failed. Please log in again.";
  if (status >= 500 || looksLikeBackendException(body)) {
    return "Event discussion could not be loaded.";
  }
  if (body) return body;
  return "Discussion request failed.";
}

function looksLikeBackendException(body) {
  if (!body) return false;

  return [
    "exception",
    "stacktrace",
    "mysqlconnector",
    "microsoft.entityframeworkcore",
    "eventdiscussionmessages",
    " at ",
  ].some((marker) => body.toLowerCase().includes(marker));
}

function isValidEventId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0;
}

export default Profile;
