import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  MoreHorizontal,
  X,
  UserRound,
  Mail,
  KeyRound,
  Shield,
  Trash2,
  ImagePlus,
} from "lucide-react";
import EventCard from "../../components/EventCard";
import AvailabilityScheduleEditor from "../../components/profile/AvailabilityScheduleEditor";
import DeepPreferencesSection from "../../components/profile/DeepPreferencesSection";
import UserAvatar from "../../components/UserAvatar";
import { CURRENT_USER, LITTLE_THINGS } from "../../data/matches";
import "./Profile.css";
import { useTranslation } from '../../hooks/useTranslation';

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
  const { t } = useTranslation();
  const { setUserProfile } = props;
  const [tab, setTab] = useState("ABOUT");
  const [eventSegment, setEventSegment] = useState("Upcoming");
  const [profileEditing, setProfileEditing] = useState(false);
  const [bio, setBio] = useState(props.userProfile.bio || "");
  const [locationDraft, setLocationDraft] = useState("");
  const [locationPrivacyDraft, setLocationPrivacyDraft] = useState("CityOnly");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileLocationPrivacy, setProfileLocationPrivacy] = useState("CityOnly");
  const [fullNameDraft, setFullNameDraft] = useState("");
  const [showFullNameDraft, setShowFullNameDraft] = useState(false);
  const [dateOfBirthDraft, setDateOfBirthDraft] = useState("");
  const [showAgeDraft, setShowAgeDraft] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSuggestionsLoading, setLocationSuggestionsLoading] = useState(false);
  const [locationSearchActive, setLocationSearchActive] = useState(false);
  const [saveButtonText, setSaveButtonText] = useState(() => t('common.save'));
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
    setSaveButtonText(t('common.save'));
    setSaveButtonAnimating(true);

    window.setTimeout(() => {
      setSaveButtonText(t('common.save'));
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
    setProfileLocationPrivacy(privacy);
    setLocationPrivacyDraft(privacy);
    setFullNameDraft(props.userProfile.fullName || "");
    setShowFullNameDraft(Boolean(props.userProfile.showFullName));
    setDateOfBirthDraft(props.userProfile.dateOfBirth || "");
    setShowAgeDraft(Boolean(props.userProfile.showAge));
  }, [
    props.currentUser?.bio,
    props.currentUser?.location,
    props.currentUser?.locationDisplayName,
    props.currentUser?.locationRawInput,
    props.currentUser?.locationPrivacy,
    props.userProfile.bio,
    props.userProfile.fullName,
    props.userProfile.showFullName,
    props.userProfile.dateOfBirth,
    props.userProfile.showAge,
  ]);

  useEffect(() => {
    if (!profileEditing || !locationSearchActive) {
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
  }, [locationDraft, locationSearchActive, profileEditing]);

  useEffect(() => {
    if (!profileEditing) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setProfileEditing(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [profileEditing]);

  useEffect(() => {
    if (!profileEditing) return undefined;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [profileEditing]);

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
        followersCount: data.followersCount ?? 0,
        followingCount: data.followingCount ?? 0,
        averageRating: data.averageRating ?? null,
        ratingsCount: data.ratingsCount ?? 0,
        fullName: data.fullName ?? "",
        showFullName: Boolean(data.showFullName),
        dateOfBirth: data.dateOfBirth ?? "",
        showAge: Boolean(data.showAge),
        age: data.age ?? null,
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

  const updateProfile = async ({ nextBio, nextPicture, nextLocation, nextPrivacy,
    nextFullName = fullNameDraft, nextShowFullName = showFullNameDraft,
    nextDateOfBirth = dateOfBirthDraft, nextShowAge = showAgeDraft }) => {
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
        fullName: nextFullName || null,
        showFullName: nextShowFullName,
        dateOfBirth: nextDateOfBirth || null,
        showAge: nextShowAge,
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
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

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
      setProfileSuccess(t('profileSettings.pictureSaved'));
    } catch (error) {
      console.error("Failed to save profile image:", error);
      setProfileError(error.message || t('profileSettings.pictureError'));
    } finally {
      setProfileSaving(false);
      event.target.value = "";
    }
  };

  const handleProfileEdit = () => {
    setLocationDraft(props.currentUser?.locationRawInput || profileLocation);
    setLocationPrivacyDraft(profileLocationPrivacy);
    setFullNameDraft(props.userProfile.fullName || "");
    setShowFullNameDraft(Boolean(props.userProfile.showFullName));
    setDateOfBirthDraft(props.userProfile.dateOfBirth || "");
    setShowAgeDraft(Boolean(props.userProfile.showAge));
    setProfileError("");
    setProfileSuccess("");
    setLocationSuggestions([]);
    setLocationSearchActive(false);
    setProfileEditing(true);
  };

  const handleProfileCancel = () => {
    setLocationDraft(props.currentUser?.locationRawInput || profileLocation);
    setLocationPrivacyDraft(profileLocationPrivacy);
    setProfileError("");
    setProfileSuccess("");
    setLocationSuggestions([]);
    setLocationSearchActive(false);
    setProfileEditing(false);
  };

  const handleLocationDraftChange = (event) => {
    setLocationDraft(event.target.value);
    setLocationSearchActive(true);
    setProfileSuccess("");
  };

  const handleLocationSuggestionSelect = (suggestion) => {
    setLocationDraft(suggestion.locationInput || suggestion.displayName);
    setProfileError("");
    setProfileSuccess("");
    setLocationSuggestions([]);
    setLocationSearchActive(false);
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      await updateProfile({
        nextBio: profileBio,
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
      setProfileLocationPrivacy(locationPrivacyDraft);
      props.setUserProfile((prev) => ({
        ...prev,
        bio: profileBio,
        location: savedProfile?.location ?? locationDraft.trim(),
        matchesCount: savedProfile?.matchesCount ?? prev.matchesCount,
        eventsJoinedCount: savedProfile?.eventsJoinedCount ?? prev.eventsJoinedCount,
        profileScorePercent: savedProfile?.profileScorePercent ?? prev.profileScorePercent,
        responseRatePercent: savedProfile?.responseRatePercent ?? prev.responseRatePercent,
        followersCount: savedProfile?.followersCount ?? prev.followersCount,
        followingCount: savedProfile?.followingCount ?? prev.followingCount,
        averageRating: savedProfile?.averageRating ?? prev.averageRating,
        ratingsCount: savedProfile?.ratingsCount ?? prev.ratingsCount,
        fullName: savedProfile?.fullName ?? fullNameDraft,
        showFullName: savedProfile?.showFullName ?? showFullNameDraft,
        dateOfBirth: savedProfile?.dateOfBirth ?? dateOfBirthDraft,
        showAge: savedProfile?.showAge ?? showAgeDraft,
        age: savedProfile?.age ?? prev.age,
      }));
      setProfileSuccess(`Location saved as ${savedLocation || "your profile location"}.`);
      setLocationSuggestions([]);
      styleButton();
      window.dispatchEvent(new Event("tokenChanged"));
      setProfileEditing(false);
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
  const followersValue =
    props.currentUser?.followersCount ?? props.userProfile?.followersCount;
  const ratingsCount = props.currentUser?.ratingsCount ?? props.userProfile?.ratingsCount ?? 0;
  const matchesDisplay = typeof matchesValue === "number" ? String(matchesValue) : "—";
  const eventsJoinedDisplay =
    typeof eventsJoinedValue === "number" ? String(eventsJoinedValue) : "—";
  const rawProfileScoreDisplay =
    typeof profileScoreValue === "number" ? `${profileScoreValue}%` : "—";

  const profileScoreDisplay = ratingsCount > 0 ? rawProfileScoreDisplay : "Not rated";
  const followersDisplay = typeof followersValue === "number" ? String(followersValue) : "—";

  const savedLocationInput = props.currentUser?.locationRawInput || props.userProfile.location || "";
  const profileHasChanges =
    locationDraft.trim() !== savedLocationInput.trim() ||
    locationPrivacyDraft !== profileLocationPrivacy;

  const statCards = [
    { icon: Heart, label: t('profile.matches'), value: matchesDisplay },
    { icon: Calendar, label: t('profile.eventsJoined'), value: eventsJoinedDisplay },
    { icon: Star, label: t('profile.score'), value: profileScoreDisplay },
    { icon: MessageCircle, label: t('profile.responseRate'), value: responseRateDisplay },
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
          <button
            type="button"
            className="profile-settings-trigger"
            aria-label={t('profileSettings.open')}
            aria-expanded={profileEditing}
            onClick={handleProfileEdit}
          >
            <MoreHorizontal size={23} />
          </button>
          <div className="profile__identity">
            <div className="profile__avatar-wrap">
              <label className="profile__avatar" title={t('profileSettings.chooseImage')}>
                {props.userProfile.profilePicture ? (
                  <img src={props.userProfile.profilePicture} alt="Profile" />
                ) : (
                  "+"
                )}
                <input type="file" accept="image/*" onChange={sendImg}
                  disabled={profileSaving} aria-label={t('profileSettings.chooseImage')} />
              </label>
            </div>
            <div className="profile__identity-text">
              <h1>{props.userProfile.showFullName && props.userProfile.fullName
                ? props.userProfile.fullName : props.currentUser.username}</h1>
              <p className="profile__username">@{props.currentUser.username}</p>
              <p className="profile__followers">
                <Users size={14} />
                <strong>{followersDisplay}</strong> {t('publicProfile.followers')}
              </p>
              <p className="profile__location">
                <MapPin size={14} />
                {profileLocation || "Add location"}
                {props.userProfile.showAge && props.userProfile.age != null ? ` · ${props.userProfile.age}` : ""}
              </p>
              <div className="profile__badges-row">
                <span className="glass-pill glass-pill--online">{t('profile.activeToday').toUpperCase()}</span>
                <span className="profile__completion">
                  {CURRENT_USER.completion}% {t('profile.complete')}
                </span>
                <span className="profile__type-badge">
                  {t(`profileOptions.${CURRENT_USER.personalityType}`)}
                </span>
              </div>
              <span className="profile__exploring">{t('profile.exploring')}</span>
              <div className="profile__trait-tags">
                {CURRENT_USER.badges.map((b) => (
                  <span key={b} className="profile__trait">
                    {t(`profileOptions.${b}`)}
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
            <button type="button" className="profile__logout" onClick={handleLogout}>
              {t('profile.logout').toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {profileEditing && createPortal((
        <div className="profile-settings-backdrop" role="presentation" onMouseDown={handleProfileCancel}>
          <section
            className="profile-settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-settings-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="profile-settings-panel__header">
              <div>
                <span>{t('profileSettings.eyebrow')}</span>
                <h2 id="profile-settings-title">{t('profileSettings.title')}</h2>
              </div>
              <button type="button" onClick={handleProfileCancel} aria-label={t('chatUi.close')}>
                <X size={20} />
              </button>
            </header>

            <div className="profile-settings-panel__content">
              <section className="profile-settings-section">
                <div className="profile-settings-section__heading">
                  <UserRound size={18} />
                  <div><h3>{t('profileSettings.publicProfile')}</h3><p>{t('profileSettings.publicProfileText')}</p></div>
                </div>

                <div className="profile-settings-picture">
                  <span className="profile-settings-picture__preview">
                    {props.userProfile.profilePicture
                      ? <img src={props.userProfile.profilePicture} alt="" />
                      : props.currentUser.username.slice(0, 2).toUpperCase()}
                  </span>
                  <div><strong>{t('profileSettings.picture')}</strong><small>{t('profileSettings.pictureText')}</small></div>
                  <label className="profile-settings-picture__button">
                    <ImagePlus size={15} />{t('profileSettings.chooseImage')}
                    <input type="file" accept="image/*" onChange={sendImg} />
                  </label>
                </div>

                <div className="profile-settings-fields">
                  <label><span>Full name</span><input type="text" maxLength="160" value={fullNameDraft}
                    onChange={(event) => setFullNameDraft(event.target.value)} placeholder="Your full name" /></label>
                  <label className="profile-settings-check"><span>Show full name on profile</span><input type="checkbox"
                    checked={showFullNameDraft} onChange={(event) => setShowFullNameDraft(event.target.checked)} /></label>
                  <label><span>Date of birth</span><input type="date" value={dateOfBirthDraft}
                    max={getMaximumDateOfBirth()} onChange={(event) => setDateOfBirthDraft(event.target.value)} /></label>
                  <label className="profile-settings-check"><span>Show my age on profile</span><input type="checkbox"
                    checked={showAgeDraft} onChange={(event) => setShowAgeDraft(event.target.checked)} /></label>
                  <label>
                    <span>{t('profile.location')}</span>
                    <input type="text" value={locationDraft} onChange={handleLocationDraftChange}
                      placeholder={t('profileUi.cityPlaceholder')} autoComplete="off" />
                    {(locationSuggestionsLoading || locationSuggestions.length > 0) && (
                      <div className="profile__location-suggestions">
                        {locationSuggestionsLoading && <span className="profile__location-suggestion-note">{t('profileSettings.findingPlaces')}</span>}
                        {!locationSuggestionsLoading && locationSuggestions.map((suggestion) => (
                          <button key={suggestion.locationInput} type="button"
                            onClick={() => handleLocationSuggestionSelect(suggestion)}>
                            <strong>{suggestion.displayName}</strong><span>{suggestion.locationInput}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </label>
                  <label>
                    <span>{t('profile.privacy')}</span>
                    <select value={locationPrivacyDraft}
                      onChange={(event) => setLocationPrivacyDraft(event.target.value)}>
                      <option value="CityOnly">{t('profile.showCity')}</option>
                      <option value="Hidden">{t('profile.hideLocation')}</option>
                    </select>
                  </label>
                </div>
                <p className="profile-settings-section__note">{t('profileSettings.locationNote')}</p>
              </section>

              <section className="profile-settings-section">
                <div className="profile-settings-section__heading">
                  <KeyRound size={18} />
                  <div><h3>{t('profileSettings.account')}</h3><p>{t('profileSettings.accountText')}</p></div>
                </div>
                <div className="profile-settings-coming-list">
                  <DisabledSetting icon={UserRound} label={t('profileSettings.username')}
                    value={`@${props.currentUser.username}`} soon={t('profileSettings.comingSoon')} />
                  <DisabledSetting icon={Mail} label={t('profileSettings.email')}
                    value={props.currentUser.email || t('profileSettings.privateValue')} soon={t('profileSettings.comingSoon')} />
                  <DisabledSetting icon={KeyRound} label={t('profileSettings.password')}
                    value="••••••••" soon={t('profileSettings.comingSoon')} />
                </div>
              </section>

              <section className="profile-settings-section">
                <div className="profile-settings-section__heading">
                  <Shield size={18} />
                  <div><h3>{t('profileSettings.privacy')}</h3><p>{t('profileSettings.privacyText')}</p></div>
                </div>
                <DisabledSetting icon={Shield} label={t('profileSettings.visibility')}
                  value={t('profileSettings.visibilityValue')} soon={t('profileSettings.comingSoon')} />
              </section>

              <section className="profile-settings-section profile-settings-section--danger">
                <div className="profile-settings-section__heading">
                  <Trash2 size={18} />
                  <div><h3>{t('profileSettings.danger')}</h3><p>{t('profileSettings.dangerText')}</p></div>
                </div>
                <button type="button" disabled>{t('profileSettings.deactivate')}<span>{t('profileSettings.comingSoon')}</span></button>
              </section>

              {profileError && <span className="profile__location-error">{profileError}</span>}
              {profileSuccess && <span className="profile__location-success">{profileSuccess}</span>}
            </div>

            <footer className="profile-settings-panel__footer">
              <button type="button" className="profile__quiet-btn" onClick={handleProfileCancel}>{t('common.cancel')}</button>
              <button type="button" className="app-btn-pill saveButton" onClick={handleProfileSave}
                disabled={profileSaving || !profileHasChanges}>
                {profileSaving ? t('common.loading') : t('common.save')}
              </button>
            </footer>
          </section>
        </div>
      ), document.body)}

      <div className="profile__body">
        <div className="profile__tabs" role="tablist">
          {TABS.map((tabName) => (
            <button
              key={tabName}
              type="button"
              role="tab"
              aria-selected={tab === tabName}
              className={`profile__tab${tab === tabName ? " profile__tab--active" : ""}`}
              onClick={() => setTab(tabName)}
            >
              {t(`profile.${tabName.toLowerCase()}`).toUpperCase()}
              {tab === tabName && <span className="profile__tab-glow" />}
            </button>
          ))}
        </div>

        <div key={tab} className="profile__tab-panel">
          {tab === "ABOUT" && (
            <div className="profile__about">
              <form className="profile__block" onSubmit={handleBioSave}>
                <h3>{t('profile.aboutMe')}</h3>
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
                  {saveButtonAnimating ? saveButtonText : t('common.save')}
                </button>
              </form>

              <section className="profile__block profile__little-things">
                <h3>{t('profile.littleThings').toUpperCase()}</h3>
                <div className="profile__little-grid">
                  {LITTLE_THINGS.map((item) => (
                    <span key={item} className="profile__little-card app-tilt-hover">
                      {t(`profileOptions.${item}`)}
                    </span>
                  ))}
                </div>
              </section>

              <div className="profile__mini-grid">
                <section className="profile__mini-card">
                  <h4>
                    <Music size={14} />
                    {t('profile.favoriteActivities')}
                  </h4>
                  <div className="profile__pills">
                    {ACTIVITIES.map((a) => (
                      <span key={a} className="profile__pill">
                        {t(`profileOptions.${a}`)}
                      </span>
                    ))}
                  </div>
                </section>
                <section className="profile__mini-card">
                  <h4>{t('profile.socialEnergy')}</h4>
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
                    {t('profile.conversationStyle')}
                  </h4>
                  <p>{t(`profileOptions.${CONVERSATION}`)}</p>
                </section>
                <section className="profile__mini-card">
                  <h4>
                    <Moon size={14} />
                    {t('profile.lookingFor')}
                  </h4>
                  <div className="profile__pills">
                    {[
                      "Meaningful connection",
                      "Adventure partner",
                      "Creative collaborator",
                    ].map((item) => (
                      <span key={item} className="profile__pill">
                        {t(`profileOptions.${item}`)}
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
                <div className="profile__matches-state">{t('profile.loadingMatches')}</div>
              )}

              {!matchesLoading && matchesError && (
                <div className="profile__matches-state profile__matches-state--error">
                  {t('profileUi.matchesError')}
                </div>
              )}

              {!matchesLoading && !matchesError && profileMatches.length === 0 && (
                <div className="profile__matches-state">
                  No Quick Match matches yet.
                </div>
              )}

              {!matchesLoading &&
                !matchesError &&
                profileMatches.map((m) => (
                  <article key={m.id} className="profile__match-card app-tilt-hover">
                    <div className="profile__match-ring">
                      <UserAvatar className="profile__match-avatar" profilePicture={m.profilePicture}
                        initials={m.initials} alt="" />
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
                            <span>{t('profileUi.more', { count: m.extraInterestsCount })}</span>
                          )}
                        </>
                      ) : (
                        <em>{t('profile.matchedConnection')}</em>
                      )}
                    </div>
                    {m.isRecentlyActive && (
                      <span className="profile__match-online">{t('profile.recentlyActive')}</span>
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
                          {t(`profileUi.${seg.toLowerCase()}`)}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="profile__event-refresh"
                      onClick={fetchProfileEvents}
                      disabled={eventsLoading}
                      aria-label={t('profileUi.refresh')}
                      aria-busy={eventsLoading}
                      title={t('profileUi.refresh')}
                    >
                      <RefreshCw size={18} aria-hidden="true" />
                    </button>
                  </div>

                  {eventsError && (
                    <div className="profile__events-error">
                      <span>{eventsError}</span>
                      <button type="button" onClick={fetchProfileEvents}>
                        {t('common.retry')}
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

function DisabledSetting({ icon: Icon, label, value, soon }) {
  return (
    <div className="profile-settings-disabled" aria-disabled="true">
      <Icon size={16} />
      <div><strong>{label}</strong><span>{value}</span></div>
      <small>{soon}</small>
    </div>
  );
}

function EventDetails({ event, onBack, onJoin }) {
  const { t } = useTranslation();
  return (
    <section className="profile__event-detail">
      <button type="button" className="profile__event-back" onClick={onBack}>
        <ArrowLeft size={16} />
        {t('profileUi.eventBack')}
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
            {event.attendeeCount}/{event.maxAttendees || t('profileUi.open')} {t('profileUi.attending')}
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
            {event.isJoinedByCurrentUser ? t('events.joined').toUpperCase() : t('events.join').toUpperCase()}
          </button>
          {event.organizerUsername && (
            <span>{t('profileUi.hostedBy', { name: event.organizerUsername })}</span>
          )}
        </div>
      </div>

      <EventDiscussion event={event} onJoin={onJoin} />
    </section>
  );
}

function EventDiscussion({ event, onJoin }) {
  const { t } = useTranslation();
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
        <h3>{t('profile.eventDiscussion')}</h3>
        <p>{t('profile.joinDiscussion')}</p>
        <button type="button" className="app-btn-pill" onClick={onJoin}>
          {t('profileUi.joinDiscuss')}
        </button>
      </section>
    );
  }

  return (
    <section className="profile__event-thread">
      <div className="profile__event-thread-head">
        <div>
          <h3>{t('profile.eventDiscussion')}</h3>
          <p>{t('profile.eventMessages')}</p>
        </div>
        <button type="button" className="profile__quiet-btn" onClick={loadDiscussion}>
          {t('profileUi.refresh')}
        </button>
      </div>

      {loading && <div className="profile__events-empty">{t('profile.loadingDiscussion')}</div>}
      {error && <div className="profile__events-error">{error}</div>}

      <div className="profile__event-messages" ref={messagesRef}>
        {!loading && messages.length === 0 && (
          <div className="profile__events-empty">{t('chat.noMessages')}</div>
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
                <span>{message.displayName || message.username || t('profileUi.member')}</span>
              )}
              <p>
                {message.isDeleted ? t('profileUi.deletedMessage') : message.body}
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
          placeholder={t('profileUi.writeDiscussion')}
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
    attendees:
      event.participantAvatars ??
      event.ParticipantAvatars ??
      event.participantInitials ??
      event.ParticipantInitials ??
      [],
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
    profilePicture: match.profilePicture ?? match.ProfilePicture ?? null,
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

function getMaximumDateOfBirth() {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 16);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
