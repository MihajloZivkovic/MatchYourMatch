import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Music,
  Coffee,
  Moon,
  RefreshCw,
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
import EventSaveButton from "../../components/events/EventSaveButton";
import AvailabilityScheduleEditor from "../../components/profile/AvailabilityScheduleEditor";
import DeepPreferencesSection from "../../components/profile/DeepPreferencesSection";
import ProfileTagEditor from "../../components/profile/ProfileTagEditor";
import { locationService } from "../../services/locationService";
import { accountService } from "../../services/accountService";
import UserAvatar from "../../components/UserAvatar";
import UserActionsMenu from "../../components/UserActionsMenu";
import ChatComposer from "../../components/chat/ChatComposer";
import AttachmentView from "../../components/chat/AttachmentView";
import AccountDangerModal from "../../components/profile/AccountDangerModal";
import ProfileStats from "../../components/profile/ProfileStats";
import FollowListModal from "../../components/profile/FollowListModal";
import "./Profile.css";
import { useTranslation } from "../../hooks/useTranslation";
import { clearAuthSession, logoutAndRedirect } from "../../services/authSession";
import { PASSWORD_POLICY_MESSAGE, getPasswordValidationMessage } from "../../utils/passwordPolicy";
import {
  announceEventsChanged,
  announceEventJoinRequestChanged,
  announceProfileChanged,
  EVENT_JOIN_REQUEST_CHANGED_EVENT,
} from "../../services/notificationService";

const TABS = ["ABOUT", "MATCHES", "EVENTS"];
const EVENT_SEGMENTS = ["Upcoming", "Past", "Saved"];

const ACTIVITY_SUGGESTIONS = [
  "Live music",
  "Gallery nights",
  "Rooftop hangs",
  "Road trips",
  "Coffee walks",
  "Gaming",
  "Study sessions",
  "Gym",
  "Running",
  "Hiking",
  "Movies",
  "Cooking",
  "Photography",
  "Art events",
  "Board games",
  "Dancing",
  "Tech meetups",
];
const CONVERSATION_STYLES = [
  "Thoughtful & playful",
  "Deep conversations",
  "Light & funny",
  "Direct & honest",
  "Calm & patient",
  "Flirty & energetic",
  "Curious listener",
  "Meme-based communication",
  "Voice notes person",
  "Texting all day",
];
const LOOKING_FOR_SUGGESTIONS = [
  "Meaningful connection",
  "Adventure partner",
  "Creative collaborator",
  "Study buddy",
  "Coffee date",
  "Gaming duo",
  "Event buddy",
  "Long conversations",
  "Low-pressure hangouts",
  "New friends",
  "Travel buddy",
  "Concert buddy",
  "Gym partner",
  "Project partner",
];
const EXPLORING_SUGGESTIONS = [
  "Deep Thinker",
  "Music Lover",
  "Night Owl",
  "Coffee Lover",
  "Gamer",
  "Study Buddy",
  "Creative",
  "Explorer",
  "Active",
  "Low Pressure",
  "Spontaneous",
];
const LITTLE_THINGS_SUGGESTIONS = [
  "Always replies late at night",
  "Makes playlists for everything",
  "Loves rainy weather",
  "Can talk about movies for hours",
  "Probably ordering iced coffee",
  "Overthinks text messages",
  "Spontaneous weekend plans",
  "Loves long walks",
  "Sends memes as love language",
  "Plans everything in notes app",
  "Needs coffee to function",
  "Remembers random details",
  "Loves cozy nights in",
  "Says one more episode",
  "Gets excited about small things",
  "Has too many screenshots",
  "Loves deep talks",
  "Always up for food",
  "Romanticizes everything",
  "Laughs at own jokes",
];

function Profile(props) {
  const { t } = useTranslation();
  const currentUser = props.currentUser ?? {};
  const userProfile = props.userProfile ?? {};
  const setUserProfile = props.setUserProfile ?? (() => {});
  const username = currentUser.username || "User";
  const formatProfileValue = (value) => {
    const key = `profileValues.${value}`;
    const translated = t(key);
    if (translated !== key) return translated;
    const legacyKey = `profileOptions.${value}`;
    const legacy = t(legacyKey);
    return legacy === legacyKey ? value : legacy;
  };
  const [tab, setTab] = useState("ABOUT");
  const [eventSegment, setEventSegment] = useState("Upcoming");
  const [profileEditing, setProfileEditing] = useState(false);
  const [bio, setBio] = useState(userProfile.bio || "");
  const [locationDraft, setLocationDraft] = useState("");
  const [locationPrivacyDraft, setLocationPrivacyDraft] = useState("CityOnly");
  const [profileLocation, setProfileLocation] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [profileLocationPrivacy, setProfileLocationPrivacy] =
    useState("CityOnly");
  const [fullNameDraft, setFullNameDraft] = useState("");
  const [showFullNameDraft, setShowFullNameDraft] = useState(false);
  const [dateOfBirthDraft, setDateOfBirthDraft] = useState("");
  const [showAgeDraft, setShowAgeDraft] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [accountDangerOpen, setAccountDangerOpen] = useState(false);
  const [accountEditor, setAccountEditor] = useState(null);
  const [accountSaving, setAccountSaving] = useState("");
  const [accountMessage, setAccountMessage] = useState({ type: "", text: "" });
  const [usernameDraft, setUsernameDraft] = useState(currentUser?.username || "");
  const [emailDraft, setEmailDraft] = useState(currentUser?.email || "");
  const [emailPasswordDraft, setEmailPasswordDraft] = useState("");
  const [emailVerificationCode, setEmailVerificationCode] = useState("");
  const [passwordDraft, setPasswordDraft] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const [visibilityDraft, setVisibilityDraft] = useState(
    userProfile?.profileVisibility || currentUser?.profileVisibility || "Standard",
  );
  const [followListType, setFollowListType] = useState(null);
  const [lifestyleEditing, setLifestyleEditing] = useState(false);
  const [lifestyleSaving, setLifestyleSaving] = useState(false);
  const [lifestyleError, setLifestyleError] = useState("");
  const [lifestyleDraft, setLifestyleDraft] = useState({
    favoriteActivities: [],
    socialEnergy: null,
    conversationStyle: "",
    lookingFor: [],
  });
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const [locationSuggestionsLoading, setLocationSuggestionsLoading] =
    useState(false);
  const [locationSearchActive, setLocationSearchActive] = useState(false);
  const [saveButtonText, setSaveButtonText] = useState(() => t("common.save"));
  const [saveButtonAnimating, setSaveButtonAnimating] = useState(false);
  const [bioSaveButtonAnimating, setBioSaveButtonAnimating] = useState(false);
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
  const [enteredThroughDashboard, setEnteredThroughDashboard] = useState(false);
  const navigate = useNavigate();
  const redirectToPublic = useCallback(() => {
    clearAuthSession();
    window.location.replace("/");
  }, []);

  const styleButton = (btn) => {
    if (btn === 1) {
      setSaveButtonText(t("common.save"));
      setSaveButtonAnimating(true);

      window.setTimeout(() => {
        setSaveButtonText(t("common.save"));
        setSaveButtonAnimating(false);
      }, 2000);
    }
    if (btn === 2) {
      setSaveButtonText(t("common.save"));
      setBioSaveButtonAnimating(true);

      window.setTimeout(() => {
        setSaveButtonText(t("common.save"));
        setBioSaveButtonAnimating(false);
      }, 2000);
    }
  };

  useEffect(() => {
    const location =
      currentUser?.locationDisplayName ||
      currentUser?.location ||
      "";
    const locationInput = currentUser?.locationRawInput || location;
    const currentBio = currentUser?.bio || userProfile.bio || "";
    const privacy = currentUser?.locationPrivacy || "CityOnly";

    setProfileLocation(location);
    setLocationDraft(locationInput);
    setProfileBio(currentBio);
    setBio(currentBio);
    setProfileLocationPrivacy(privacy);
    setLocationPrivacyDraft(privacy);
    setFullNameDraft(userProfile.fullName || "");
    setShowFullNameDraft(Boolean(userProfile.showFullName));
    setDateOfBirthDraft(toDateInputValue(userProfile.dateOfBirth));
    setShowAgeDraft(Boolean(userProfile.showAge));
  }, [
    currentUser?.bio,
    currentUser?.location,
    currentUser?.locationDisplayName,
    currentUser?.locationRawInput,
    currentUser?.locationPrivacy,
    userProfile.bio,
    userProfile.fullName,
    userProfile.showFullName,
    userProfile.dateOfBirth,
    userProfile.showAge,
  ]);

  useEffect(() => {
    setUsernameDraft(currentUser?.username || "");
    setEmailDraft(userProfile?.email || currentUser?.email || "");
    setVisibilityDraft(
      userProfile?.profileVisibility ||
        currentUser?.profileVisibility ||
        "Standard",
    );
  }, [
    currentUser?.username,
    currentUser?.email,
    currentUser?.profileVisibility,
    userProfile?.email,
    userProfile?.profileVisibility,
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
        setLocationSuggestions(
          await locationService.search(query, controller.signal),
        );
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
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0)
      document.body.style.paddingRight = `${scrollbarWidth}px`;
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
        if (response.status === 401 || response.status === 404) {
          redirectToPublic();
          return;
        }
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
        pendingEmail: data.pendingEmail ?? "",
        profileVisibility: data.profileVisibility ?? prev.profileVisibility ?? "Standard",
        followersCount: data.followersCount ?? 0,
        followingCount: data.followingCount ?? 0,
        averageRating: data.averageRating ?? null,
        ratingsCount: data.ratingsCount ?? 0,
        fullName: data.fullName ?? "",
        showFullName: Boolean(data.showFullName),
        dateOfBirth: data.dateOfBirth ?? "",
        showAge: Boolean(data.showAge),
        age: data.age ?? null,
        littleThings: Array.isArray(data.littleThings) ? data.littleThings : [],
        currentlyExploring: Array.isArray(data.currentlyExploring)
          ? data.currentlyExploring
          : [],
        favoriteActivities: Array.isArray(data.favoriteActivities)
          ? data.favoriteActivities
          : [],
        socialEnergy:
          typeof data.socialEnergy === "number" ? data.socialEnergy : null,
        conversationStyle: data.conversationStyle || "",
        lookingFor: Array.isArray(data.lookingFor) ? data.lookingFor : [],
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
  }, [redirectToPublic, setUserProfile]);

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
            .sort(
              (first, second) =>
                new Date(second.matchedAt) - new Date(first.matchedAt),
            )
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
    setProfileEditing(false);
    logoutAndRedirect(navigate);
  };

  const updateProfile = async ({
    nextBio,
    nextPicture,
    nextLocation,
    nextPrivacy,
    nextFullName = fullNameDraft,
    nextShowFullName = showFullNameDraft,
    nextDateOfBirth = dateOfBirthDraft,
    nextShowAge = showAgeDraft,
  }) => {
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
      if (response.status === 401 || response.status === 404) {
        redirectToPublic();
        return null;
      }
      const body = await response.text();
      throw new Error(body || "We couldn't save your profile right now.");
    }

    return response.json();
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
        nextLocation:
          currentUser?.locationRawInput || userProfile.location,
        nextPrivacy: profileLocationPrivacy,
      });

      props.setUserProfile((prev) => ({
        ...prev,
        profilePicture: convertedImage,
      }));
      announceProfileChanged({ source: "profile-picture" });
      setProfileSuccess(t("profileSettings.pictureSaved"));
    } catch (error) {
      console.error("Failed to save profile image:", error);
      setProfileError(error.message || t("profileSettings.pictureError"));
    } finally {
      setProfileSaving(false);
      event.target.value = "";
    }
  };

  const handleProfileEdit = () => {
    setLocationDraft(currentUser?.locationRawInput || profileLocation);
    setLocationPrivacyDraft(profileLocationPrivacy);
    setFullNameDraft(userProfile.fullName || "");
    setShowFullNameDraft(Boolean(userProfile.showFullName));
    setDateOfBirthDraft(toDateInputValue(userProfile.dateOfBirth));
    setShowAgeDraft(Boolean(userProfile.showAge));
    setProfileError("");
    setProfileSuccess("");
    setLocationSuggestions([]);
    setLocationSearchActive(false);
    setProfileEditing(true);
  };

  function HandleEnteredThroughDashboard() {
    setEnteredThroughDashboard(true);
    setTimeout(() => {
      setEnteredThroughDashboard(false);
    }, 5000);
  }

  const handleProfileCancel = () => {
    setLocationDraft(currentUser?.locationRawInput || profileLocation);
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

  const openAccountEditor = (editor) => {
    setAccountEditor(editor);
    setAccountMessage({ type: "", text: "" });
    setProfileError("");
    setProfileSuccess("");
    if (editor === "username") setUsernameDraft(currentUser?.username || "");
    if (editor === "email") {
      setEmailDraft(userProfile?.email || currentUser?.email || "");
      setEmailPasswordDraft("");
      setEmailVerificationCode("");
    }
    if (editor === "password") {
      setPasswordDraft({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
    }
    if (editor === "visibility") {
      setVisibilityDraft(
        userProfile?.profileVisibility ||
          currentUser?.profileVisibility ||
          "Standard",
      );
    }
  };

  const cancelAccountEditor = () => {
    setAccountEditor(null);
    setAccountSaving("");
    setAccountMessage({ type: "", text: "" });
    setEmailPasswordDraft("");
    setEmailVerificationCode("");
    setPasswordDraft({
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
  };

  const applySavedProfile = (saved) => {
    if (!saved) return;
    props.setUserProfile((previous) => ({
      ...previous,
      ...saved,
      pendingEmail: saved.pendingEmail ?? previous.pendingEmail ?? "",
      profileVisibility: saved.profileVisibility ?? previous.profileVisibility ?? "Standard",
    }));
    announceProfileChanged({ source: "account-profile" });
  };

  const applyEmailChangeResponse = (saved) => {
    if (!saved) return;
    props.setUserProfile((previous) => ({
      ...previous,
      ...saved,
      email: saved.email ?? previous.email,
      pendingEmail: saved.pendingEmail ?? "",
    }));
    announceProfileChanged({ source: "email" });
  };

  const saveUsername = async () => {
    setAccountSaving("username");
    setAccountMessage({ type: "", text: "" });
    try {
      const saved = await accountService.updateUsername({
        username: usernameDraft.trim(),
      });
      applySavedProfile(saved);
      setAccountMessage({ type: "success", text: "Username updated." });
      setAccountEditor(null);
    } catch (error) {
      setAccountMessage({ type: "error", text: error.message || "Username could not be updated." });
    } finally {
      setAccountSaving("");
    }
  };

  const saveEmail = async () => {
    setAccountSaving("email");
    setAccountMessage({ type: "", text: "" });
    try {
      const emailError = getEmailChangeRequestError(emailDraft, emailPasswordDraft);
      if (emailError) {
        setAccountMessage({ type: "error", text: emailError });
        return;
      }

      const result = await accountService.updateEmail({
        newEmail: emailDraft.trim(),
        password: emailPasswordDraft,
      });
      applyEmailChangeResponse(result);
      setEmailPasswordDraft("");
      setEmailVerificationCode("");
      setAccountMessage({
        type: "success",
        text: `Verification code sent to ${result?.pendingEmail || emailDraft.trim()}.`,
      });
      setAccountEditor(null);
    } catch (error) {
      setAccountMessage({ type: "error", text: getEmailChangeErrorMessage(error) });
    } finally {
      setAccountSaving("");
    }
  };

  const verifyEmailChange = async () => {
    const code = emailVerificationCode.trim();
    if (!/^\d{6}$/.test(code)) {
      setAccountMessage({
        type: "error",
        text: "Invalid or expired verification code.",
      });
      return;
    }

    setAccountSaving("emailVerify");
    setAccountMessage({ type: "", text: "" });

    try {
      const saved = await accountService.verifyEmailChange({ code });
      applyEmailChangeResponse(saved);
      setEmailVerificationCode("");
      setEmailDraft(saved?.email || emailDraft);
      setAccountMessage({ type: "success", text: "Email changed successfully." });
    } catch (error) {
      setAccountMessage({ type: "error", text: getEmailChangeErrorMessage(error) });
    } finally {
      setAccountSaving("");
    }
  };

  const resendEmailChangeCode = async () => {
    setAccountSaving("emailResend");
    setAccountMessage({ type: "", text: "" });

    try {
      const result = await accountService.resendEmailChangeCode();
      applyEmailChangeResponse(result);
      setAccountMessage({ type: "success", text: "Verification code sent again." });
    } catch (error) {
      setAccountMessage({ type: "error", text: getEmailChangeErrorMessage(error) });
    } finally {
      setAccountSaving("");
    }
  };

  const cancelEmailChange = async () => {
    setAccountSaving("emailCancel");
    setAccountMessage({ type: "", text: "" });

    try {
      const saved = await accountService.cancelEmailChange();
      applyEmailChangeResponse(saved);
      setEmailVerificationCode("");
      setAccountMessage({ type: "success", text: "Pending email change cancelled." });
    } catch (error) {
      setAccountMessage({ type: "error", text: getEmailChangeErrorMessage(error) });
    } finally {
      setAccountSaving("");
    }
  };

  const savePassword = async () => {
    const passwordError = getPasswordFormError(passwordDraft);
    if (passwordError) {
      setAccountMessage({ type: "error", text: passwordError });
      return;
    }

    setAccountSaving("password");
    setAccountMessage({ type: "", text: "" });

    try {
      await accountService.updatePassword(passwordDraft);
      setPasswordDraft({
        currentPassword: "",
        newPassword: "",
        confirmNewPassword: "",
      });
      setAccountMessage({ type: "success", text: "Password updated." });
      setAccountEditor(null);
    } catch (error) {
      setAccountMessage({
        type: "error",
        text: getPasswordChangeErrorMessage(error),
      });
    } finally {
      setAccountSaving("");
    }
  };

  const saveVisibility = async () => {
    setAccountSaving("visibility");
    setAccountMessage({ type: "", text: "" });
    try {
      const saved = await accountService.updateProfileVisibility({
        profileVisibility: visibilityDraft,
      });
      applySavedProfile(saved);
      setAccountMessage({ type: "success", text: "Profile visibility updated." });
      setAccountEditor(null);
    } catch (error) {
      setAccountMessage({ type: "error", text: error.message || "Profile visibility could not be updated." });
    } finally {
      setAccountSaving("");
    }
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    setProfileError("");
    setProfileSuccess("");

    try {
      const savedProfile = await updateProfile({
        nextBio: profileBio,
        nextPicture: userProfile.profilePicture,
        nextLocation: locationDraft.trim(),
        nextPrivacy: locationPrivacyDraft,
      });
      const savedLocation =
        savedProfile?.locationDisplayName ||
        savedProfile?.location ||
        (locationPrivacyDraft === "Hidden"
          ? "Location hidden"
          : locationDraft.trim());

      setProfileLocation(savedLocation);
      setProfileLocationPrivacy(locationPrivacyDraft);
      props.setUserProfile((prev) => ({
        ...prev,
        bio: profileBio,
        location: savedProfile?.location ?? locationDraft.trim(),
        matchesCount: savedProfile?.matchesCount ?? prev.matchesCount,
        eventsJoinedCount:
          savedProfile?.eventsJoinedCount ?? prev.eventsJoinedCount,
        profileScorePercent:
          savedProfile?.profileScorePercent ?? prev.profileScorePercent,
        responseRatePercent:
          savedProfile?.responseRatePercent ?? prev.responseRatePercent,
        pendingEmail: savedProfile?.pendingEmail ?? prev.pendingEmail ?? "",
        profileVisibility:
          savedProfile?.profileVisibility ?? prev.profileVisibility ?? "Standard",
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
      setProfileSuccess(
        `Location saved as ${savedLocation || "your profile location"}.`,
      );
      setLocationSuggestions([]);
      styleButton(1);
      announceProfileChanged({ source: "profile" });
      setProfileEditing(false);
    } catch (err) {
      setProfileError(
        err.message ||
          "We couldn't find that location. Try entering city and country.",
      );
    } finally {
      setProfileSaving(false);
    }
  };

  const saveProfileTags = async (changes) => {
    const response = await fetch("/api/UserProfile/me/tags", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        littleThings:
          changes.littleThings ?? userProfile.littleThings ?? [],
        currentlyExploring:
          changes.currentlyExploring ??
          userProfile.currentlyExploring ??
          [],
      }),
    });
    if (!response.ok)
      throw new Error((await response.text()) || t("profileTags.saveError"));
    const saved = await response.json();
    props.setUserProfile((previous) => ({
      ...previous,
      littleThings: Array.isArray(saved.littleThings) ? saved.littleThings : [],
      currentlyExploring: Array.isArray(saved.currentlyExploring)
        ? saved.currentlyExploring
        : [],
    }));
    announceProfileChanged({ source: "profile-tags" });
  };

  const startLifestyleEdit = () => {
    setLifestyleDraft({
      favoriteActivities: [...(userProfile.favoriteActivities || [])],
      socialEnergy: userProfile.socialEnergy,
      conversationStyle: userProfile.conversationStyle || "",
      lookingFor: [...(userProfile.lookingFor || [])],
    });
    setLifestyleError("");
    setLifestyleEditing(true);
  };

  const saveLifestyle = async () => {
    setLifestyleSaving(true);
    setLifestyleError("");
    try {
      const response = await fetch("/api/UserProfile/me/lifestyle", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(lifestyleDraft),
      });
      if (!response.ok)
        throw new Error(
          (await response.text()) || t("profileLifestyle.saveError"),
        );
      const saved = await response.json();
      props.setUserProfile((previous) => ({
        ...previous,
        favoriteActivities: Array.isArray(saved.favoriteActivities)
          ? saved.favoriteActivities
          : [],
        socialEnergy:
          typeof saved.socialEnergy === "number" ? saved.socialEnergy : null,
        conversationStyle: saved.conversationStyle || "",
        lookingFor: Array.isArray(saved.lookingFor) ? saved.lookingFor : [],
      }));
      announceProfileChanged({ source: "profile-lifestyle" });
      setLifestyleEditing(false);
    } catch (error) {
      setLifestyleError(error.message || t("profileLifestyle.saveError"));
    } finally {
      setLifestyleSaving(false);
    }
  };

  const socialEnergyLabel = (value) =>
    value <= 30
      ? t("profileLifestyle.lowKey")
      : value <= 70
        ? t("profileLifestyle.balanced")
        : t("profileLifestyle.verySocial");

  const handleBioSave = async (event) => {
    event.preventDefault();
    const bioText = bio.trim();

    try {
      await updateProfile({
        nextBio: bioText,
        nextPicture: userProfile.profilePicture,
        nextLocation:
          currentUser?.locationRawInput || userProfile.location,
        nextPrivacy: profileLocationPrivacy,
      });

      setProfileBio(bioText);
      props.setUserProfile((prev) => ({
        ...prev,
        bio: bioText,
      }));
      styleButton(2);
      announceProfileChanged({ source: "profile-bio" });
    } catch (error) {
      console.error("Failed to save bio:", error);
    }
  };

  const responseRateValue =
    currentUser?.responseRatePercent ??
    userProfile?.responseRatePercent;
  const matchesValue =
    currentUser?.matchesCount ?? userProfile?.matchesCount;
  const eventsJoinedValue =
    currentUser?.eventsJoinedCount ??
    userProfile?.eventsJoinedCount;
  const profileScoreValue =
    currentUser?.profileScorePercent ??
    userProfile?.profileScorePercent;
  const followersValue =
    currentUser?.followersCount ?? userProfile?.followersCount;
  const ratingsCount =
    currentUser?.ratingsCount ?? userProfile?.ratingsCount ?? 0;
  const followersDisplay =
    typeof followersValue === "number" ? String(followersValue) : "—";

  const profileUserId = currentUser?.id ?? userProfile?.id;

  const followingValue = currentUser?.followingCount ?? userProfile?.followingCount;

  const followingDisplay =
    typeof followingValue === "number" ? String(followingValue) : "—";



  const pendingEmail =
    userProfile?.pendingEmail || currentUser?.pendingEmail || "";
  const displayEmail = userProfile?.email || currentUser?.email || "";
  const isEmailVerifyBusy = accountSaving === "emailVerify";
  const isEmailResendBusy = accountSaving === "emailResend";
  const isEmailCancelBusy = accountSaving === "emailCancel";

  const savedLocationInput =
    currentUser?.locationRawInput || userProfile.location || "";
  const profileHasChanges =
    locationDraft.trim() !== savedLocationInput.trim() ||
    locationPrivacyDraft !== profileLocationPrivacy ||
    fullNameDraft.trim() !== (userProfile.fullName || "").trim() ||
    showFullNameDraft !== Boolean(userProfile.showFullName) ||
    dateOfBirthDraft !== toDateInputValue(userProfile.dateOfBirth) ||
    showAgeDraft !== Boolean(userProfile.showAge);

  const eventLists = profileEvents;
  const passwordValidationMessage =
    accountEditor === "password" ? getPasswordFormError(passwordDraft) : "";
  const isPasswordSaveDisabled =
    accountSaving === "password" || Boolean(passwordValidationMessage);
  const eventEmptyCopy = {
    Upcoming: "No upcoming joined events.",
    Past: "No past events yet.",
    Saved: t("events.noSaved"),
  };

  const handleJoinEvent = async (eventId) => {
    if (!isValidEventId(eventId)) {
      setEventsError(
        "Event could not be joined because its database id is missing.",
      );
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
      setSelectedEvent((current) =>
        current?.id === eventId ? updated : current,
      );
      await fetchProfileEvents();
      announceEventsChanged({ source: "profile-join", eventId });
    } catch (error) {
      setEventsError(error.message || "Event could not be joined.");
    }
  };

  const handleCancelEventJoinRequest = async (eventId) => {
    try {
      const response = await fetch(`/api/Events/${eventId}/join-request`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok)
        throw new Error(
          (await response.text()) || t("events.cancelRequestError"),
        );
      const updated = mapApiEvent(await response.json());
      setSelectedEvent((current) =>
        current?.id === eventId ? updated : current,
      );
      await fetchProfileEvents();
      announceEventsChanged({ source: "profile-cancel-join-request", eventId });
    } catch (error) {
      setEventsError(error.message || t("events.cancelRequestError"));
    }
  };

  const handleSavedEventChange = (eventId, isSaved) => {
    setProfileEvents((current) => {
      const source = [
        ...current.Upcoming,
        ...current.Past,
        ...current.Saved,
      ].find((event) => event.id === eventId);
      const updateGroup = (events) =>
        events.map((event) =>
          event.id === eventId ? { ...event, isSaved } : event,
        );
      const saved = isSaved
        ? current.Saved.some((event) => event.id === eventId) || !source
          ? updateGroup(current.Saved)
          : [{ ...source, isSaved: true }, ...current.Saved]
        : current.Saved.filter((event) => event.id !== eventId);
      return {
        Upcoming: updateGroup(current.Upcoming),
        Past: updateGroup(current.Past),
        Saved: saved,
      };
    });
    setSelectedEvent((current) =>
      current?.id === eventId ? { ...current, isSaved } : current,
    );
  };

  return (
    <div className="page-fade-in profile">
      <header className="profile__header">
        <div className="profile__header-mesh" aria-hidden="true" />
        <div className="profile__header-inner">
          <button
            type="button"
            className="profile-settings-trigger"
            aria-label={t("profileSettings.open")}
            aria-expanded={profileEditing}
            onClick={handleProfileEdit}
          >
            <MoreHorizontal size={23} />
          </button>
          <div className="profile__identity">
            <div className="profile__avatar-wrap">
              <label
                className="profile__avatar"
                title={t("profileSettings.chooseImage")}
              >
                {userProfile.profilePicture ? (
                  <img src={userProfile.profilePicture} alt="Profile" />
                ) : (
                  "+"
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={sendImg}
                  disabled={profileSaving}
                  aria-label={t("profileSettings.chooseImage")}
                />
              </label>
            </div>
            <div className="profile__identity-text">
              <h1>
                {userProfile.showFullName && userProfile.fullName
                  ? userProfile.fullName
                  : username}
              </h1>
              <p className="profile__username">@{username}</p>
              <button
                type="button"
                className="profile__followers profile__followers--clickable"
                onClick={() => setFollowListType("followers")}
                disabled={!profileUserId}
              >
                <Users size={14} />
                <strong>{followersDisplay}</strong>{" "}
                {t("publicProfile.followers")}
              </button>
              <button
                type="button"
                className="profile__followers profile__followers--clickable"
                onClick={() => setFollowListType("following")}
                disabled={!profileUserId}
              >
                <Users size={14} />
                <strong>{followingDisplay}</strong>{" "}
                {t("publicProfile.following")}
              </button>
              <p className="profile__location">
                <MapPin size={14} />
                {profileLocation ? (
                  <p
                    className="pointer"
                    onClick={() => {
                      handleProfileEdit();
                      HandleEnteredThroughDashboard();
                    }}
                  >
                    {profileLocation}
                  </p>
                ) : (
                  <p
                    className="pointer"
                    onClick={() => {
                      handleProfileEdit();
                      HandleEnteredThroughDashboard();
                    }}
                  >
                    Add location
                  </p>
                )}
                {userProfile.showAge && userProfile.age != null
                  ? ` · ${userProfile.age}`
                  : ""}
              </p>
              <ProfileTagEditor
                compact
                title={t("profile.exploring")}
                tags={userProfile.currentlyExploring || []}
                maxTags={5}
                placeholder={t("profileTags.exploringPlaceholder")}
                emptyText={t("profile.noExploringTags")}
                suggestions={EXPLORING_SUGGESTIONS}
                formatTag={formatProfileValue}
                onSave={(tags) => saveProfileTags({ currentlyExploring: tags })}
              />
            </div>
          </div>

          <ProfileStats
            matches={matchesValue}
            eventsJoined={eventsJoinedValue}
            profileScore={profileScoreValue}
            responseRate={responseRateValue}
            ratingsCount={ratingsCount}
            labels={{
              matches: t("profile.matches"),
              eventsJoined: t("profile.eventsJoined"),
              profileScore: t("profile.score"),
              responseRate: t("profile.responseRate"),
            }}
          />
          {profileLoadError && (
            <div className="profile__api-error">
              <span>{profileLoadError}</span>
              <button
                type="button"
                onClick={fetchProfile}
                disabled={profileLoading}
              >
                {profileLoading ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

          <div className="profile__header-actions">
            <button
              type="button"
              className="profile__logout"
              onClick={handleLogout}
            >
              {t("profile.logout").toUpperCase()}
            </button>
          </div>
        </div>
      </header>

      {profileEditing &&
        createPortal(
          <div
            className="profile-settings-backdrop"
            role="presentation"
            onMouseDown={handleProfileCancel}
          >
            <section
              className="profile-settings-panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="profile-settings-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <header className="profile-settings-panel__header">
                <div>
                  <span>{t("profileSettings.eyebrow")}</span>
                  <h2 id="profile-settings-title">
                    {t("profileSettings.title")}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleProfileCancel}
                  aria-label={t("chatUi.close")}
                >
                  <X size={20} />
                </button>
              </header>

              <div className="profile-settings-panel__content">
                <section className="profile-settings-section">
                  <div className="profile-settings-section__heading">
                    <UserRound size={18} />
                    <div>
                      <h3>{t("profileSettings.publicProfile")}</h3>
                      <p>{t("profileSettings.publicProfileText")}</p>
                    </div>
                  </div>

                  <div className="profile-settings-picture">
                    <span className="profile-settings-picture__preview">
                      {userProfile.profilePicture ? (
                        <img src={userProfile.profilePicture} alt="" />
                      ) : (
                        username.slice(0, 2).toUpperCase()
                      )}
                    </span>
                    <div>
                      <strong>{t("profileSettings.picture")}</strong>
                      <small>{t("profileSettings.pictureText")}</small>
                    </div>
                    <label className="profile-settings-picture__button">
                      <ImagePlus size={15} />
                      {t("profileSettings.chooseImage")}
                      <input type="file" accept="image/*" onChange={sendImg} />
                    </label>
                  </div>

                  <div className="profile-settings-fields">
                    <label>
                      <span>Full name</span>
                      <input
                        type="text"
                        maxLength="160"
                        value={fullNameDraft}
                        onChange={(event) =>
                          setFullNameDraft(event.target.value)
                        }
                        placeholder="Your full name"
                      />
                    </label>
                    <label className="profile-settings-check">
                      <span>Show full name on profile</span>
                      <input
                        type="checkbox"
                        checked={showFullNameDraft}
                        onChange={(event) =>
                          setShowFullNameDraft(event.target.checked)
                        }
                      />
                    </label>
                    <label>
                      <span>Date of birth</span>
                      <input
                        type="date"
                        value={dateOfBirthDraft}
                        max={getMaximumDateOfBirth()}
                        onChange={(event) =>
                          setDateOfBirthDraft(event.target.value)
                        }
                      />
                    </label>
                    <label className="profile-settings-check">
                      <span>Show my age on profile</span>
                      <input
                        type="checkbox"
                        checked={showAgeDraft}
                        onChange={(event) =>
                          setShowAgeDraft(event.target.checked)
                        }
                      />
                    </label>
                    <label>
                      <span>{t("profile.location")}</span>
                      <input
                        type="text"
                        value={locationDraft}
                        onChange={handleLocationDraftChange}
                        placeholder={t("profileUi.cityPlaceholder")}
                        autoComplete="off"
                        className={
                          enteredThroughDashboard ? "indicationBorder" : ""
                        }
                      />
                      {(locationSuggestionsLoading ||
                        locationSuggestions.length > 0) && (
                        <div className="profile__location-suggestions">
                          {locationSuggestionsLoading && (
                            <span className="profile__location-suggestion-note">
                              {t("profileSettings.findingPlaces")}
                            </span>
                          )}
                          {!locationSuggestionsLoading &&
                            locationSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.locationInput}
                                type="button"
                                onClick={() =>
                                  handleLocationSuggestionSelect(suggestion)
                                }
                              >
                                <strong>{suggestion.displayName}</strong>
                                <span>{suggestion.locationInput}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </label>
                    <label>
                      <span>{t("profile.privacy")}</span>
                      <select
                        value={locationPrivacyDraft}
                        onChange={(event) =>
                          setLocationPrivacyDraft(event.target.value)
                        }
                      >
                        <option value="CityOnly">
                          {t("profile.showCity")}
                        </option>
                        <option value="Hidden">
                          {t("profile.hideLocation")}
                        </option>
                      </select>
                    </label>
                  </div>
                  <p className="profile-settings-section__note">
                    {t("profileSettings.locationNote")}
                  </p>
                </section>

                <section className="profile-settings-section">
                  <div className="profile-settings-section__heading">
                    <KeyRound size={18} />
                    <div>
                      <h3>{t("profileSettings.account")}</h3>
                      <p>{t("profileSettings.accountText")}</p>
                    </div>
                  </div>
                  <div className="profile-settings-coming-list">
                    <EditableSetting
                      icon={UserRound}
                      label={t("profileSettings.username")}
                      value={`@${username}`}
                      active={accountEditor === "username"}
                      onOpen={() => openAccountEditor("username")}
                    >
                      <label>
                        <span>{t("profileSettings.username")}</span>
                        <input
                          type="text"
                          value={usernameDraft}
                          onChange={(event) => setUsernameDraft(event.target.value)}
                          autoComplete="username"
                        />
                      </label>
                      <SettingActions
                        saving={accountSaving === "username"}
                        onSave={saveUsername}
                        onCancel={cancelAccountEditor}
                      />
                    </EditableSetting>
                    <EditableSetting
                      icon={Mail}
                      label={t("profileSettings.email")}
                      value={
                        pendingEmail
                          ? `${displayEmail} (pending ${pendingEmail})`
                          : displayEmail ||
                            t("profileSettings.privateValue")
                      }
                      active={accountEditor === "email"}
                      onOpen={() => openAccountEditor("email")}
                    >
                      <label>
                        <span>{t("profileSettings.email")}</span>
                        <input
                          type="email"
                          value={emailDraft}
                          onChange={(event) => setEmailDraft(event.target.value)}
                          autoComplete="email"
                        />
                      </label>
                      <label>
                        <span>Current password</span>
                        <input
                          type="password"
                          value={emailPasswordDraft}
                          onChange={(event) => setEmailPasswordDraft(event.target.value)}
                          autoComplete="current-password"
                        />
                      </label>
                      <SettingActions
                        saving={accountSaving === "email"}
                        onSave={saveEmail}
                        onCancel={cancelAccountEditor}
                      />
                    </EditableSetting>
                    {pendingEmail && (
                      <div className="profile-settings-email-verify">
                        <div>
                          <strong>Verify new email</strong>
                          <p>
                            We sent a verification code to {pendingEmail}. Enter
                            the code below to complete your email change.
                          </p>
                        </div>
                        <label>
                          <span>Verification code</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={emailVerificationCode}
                            onChange={(event) =>
                              setEmailVerificationCode(
                                event.target.value.replace(/\D/g, "").slice(0, 6),
                              )
                            }
                            autoComplete="one-time-code"
                          />
                        </label>
                        <div className="profile-settings-email-verify__actions">
                          <button
                            type="button"
                            className="app-btn-pill"
                            disabled={isEmailVerifyBusy || emailVerificationCode.trim().length !== 6}
                            onClick={verifyEmailChange}
                          >
                            {isEmailVerifyBusy ? "Verifying..." : "Verify"}
                          </button>
                          <button
                            type="button"
                            className="profile__quiet-btn"
                            disabled={isEmailResendBusy}
                            onClick={resendEmailChangeCode}
                          >
                            {isEmailResendBusy ? "Sending..." : "Resend code"}
                          </button>
                          <button
                            type="button"
                            className="profile__quiet-btn"
                            disabled={isEmailCancelBusy}
                            onClick={cancelEmailChange}
                          >
                            {isEmailCancelBusy ? "Cancelling..." : "Cancel pending change"}
                          </button>
                        </div>
                      </div>
                    )}
                    <EditableSetting
                      icon={KeyRound}
                      label={t("profileSettings.password")}
                      value="••••••••"
                      active={accountEditor === "password"}
                      onOpen={() => openAccountEditor("password")}
                    >
                      <label>
                        <span>Current password</span>
                        <input
                          type="password"
                          value={passwordDraft.currentPassword}
                          onChange={(event) =>
                            setPasswordDraft((current) => ({
                              ...current,
                              currentPassword: event.target.value,
                            }))
                          }
                          autoComplete="current-password"
                        />
                      </label>
                      <label>
                        <span>New password</span>
                        <input
                          type="password"
                          value={passwordDraft.newPassword}
                          onChange={(event) =>
                            setPasswordDraft((current) => ({
                              ...current,
                              newPassword: event.target.value,
                            }))
                          }
                          autoComplete="new-password"
                        />
                        <small className="profile-settings-password-help">
                          {PASSWORD_POLICY_MESSAGE}
                        </small>
                      </label>
                      <label>
                        <span>Confirm new password</span>
                        <input
                          type="password"
                          value={passwordDraft.confirmNewPassword}
                          onChange={(event) =>
                            setPasswordDraft((current) => ({
                              ...current,
                              confirmNewPassword: event.target.value,
                            }))
                          }
                          autoComplete="new-password"
                        />
                      </label>
                      {passwordValidationMessage && (
                        <p className="profile-settings-field-error">
                          {passwordValidationMessage}
                        </p>
                      )}
                      <SettingActions
                        saving={accountSaving === "password"}
                        disabled={isPasswordSaveDisabled}
                        disabledReason={passwordValidationMessage}
                        onSave={savePassword}
                        onCancel={cancelAccountEditor}
                      />
                    </EditableSetting>
                  </div>
                </section>

                <section className="profile-settings-section">
                  <div className="profile-settings-section__heading">
                    <Shield size={18} />
                    <div>
                      <h3>{t("profileSettings.privacy")}</h3>
                      <p>{t("profileSettings.privacyText")}</p>
                    </div>
                  </div>
                  <EditableSetting
                    icon={Shield}
                    label={t("profileSettings.visibility")}
                    value={formatVisibilityLabel(
                      userProfile?.profileVisibility ||
                        currentUser?.profileVisibility ||
                        "Standard",
                    )}
                    active={accountEditor === "visibility"}
                    onOpen={() => openAccountEditor("visibility")}
                  >
                    <label>
                      <span>{t("profileSettings.visibility")}</span>
                      <select
                        value={visibilityDraft}
                        onChange={(event) => setVisibilityDraft(event.target.value)}
                      >
                        <option value="Standard">Standard</option>
                        <option value="Private">Private</option>
                      </select>
                    </label>
                    <div className="profile-settings-visibility-help">
                      <p>
                        <strong>Standard(Public)</strong>
                        <span>Visible in search, matches, event participants and public profile views.</span>
                      </p>
                      <p>
                        <strong>Private</strong>
                        <span>Hidden from global search, Deep Match and Quick Match suggestions. Other users see only limited profile details.</span>
                      </p>
                    </div>
                    <SettingActions
                      saving={accountSaving === "visibility"}
                      onSave={saveVisibility}
                      onCancel={cancelAccountEditor}
                    />
                  </EditableSetting>
                </section>

                <section className="profile-settings-section profile-settings-section--danger">
                  <div className="profile-settings-section__heading">
                    <Trash2 size={18} />
                    <div>
                      <h3>{t("profileSettings.danger")}</h3>
                      <p>{t("profileSettings.dangerText")}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAccountDangerOpen(true)}
                  >
                    {t("profileSettings.deactivate")}
                    <span>{t("common.view")}</span>
                  </button>
                </section>

                {profileError && (
                  <span className="profile__location-error">
                    {profileError}
                  </span>
                )}
                {profileSuccess && (
                  <span className="profile__location-success">
                    {profileSuccess}
                  </span>
                )}
                {accountMessage.text && (
                  <span
                    className={
                      accountMessage.type === "error"
                        ? "profile__location-error"
                        : "profile__location-success"
                    }
                  >
                    {accountMessage.text}
                  </span>
                )}
              </div>

              <footer className="profile-settings-panel__footer">
                <button
                  type="button"
                  className="profile__quiet-btn"
                  onClick={handleProfileCancel}
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="button"
                  className="app-btn-pill saveButton"
                  onClick={handleProfileSave}
                  disabled={profileSaving || !profileHasChanges}
                >
                  {profileSaving ? t("common.loading") : t("common.save")}
                </button>
              </footer>
            </section>
          </div>,
          document.body,
        )}

      {accountDangerOpen && (
        <AccountDangerModal onClose={() => setAccountDangerOpen(false)} />
      )}

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
                <h3>{t("profile.aboutMe")}</h3>
                <textarea
                  name="bio"
                  placeholder="Designer and music lover based in Brooklyn. Always up for a rooftop sunset, live jazz, or a spontaneous road trip. Looking for genuine connection and good conversation."
                  value={bio}
                  onChange={(event) => setBio(event.target.value)}
                />
                <button
                  type="submit"
                  className={`saveButton${bioSaveButtonAnimating ? " saveAnimation" : ""}`}
                >
                  {!bioSaveButtonAnimating ? saveButtonText : `${t('profileUi.saved')}`}
                </button>
              </form>

              <section className="profile__block profile__little-things">
                <ProfileTagEditor
                  title={t("profile.littleThings").toUpperCase()}
                  tags={userProfile.littleThings || []}
                  maxTags={10}
                  placeholder={t("profileTags.littlePlaceholder")}
                  emptyText={t("profileTags.noLittleThings")}
                  suggestions={LITTLE_THINGS_SUGGESTIONS}
                  formatTag={formatProfileValue}
                  onSave={(tags) => saveProfileTags({ littleThings: tags })}
                />
              </section>

              <section className="profile__lifestyle">
                <div className="profile__lifestyle-heading">
                  <h3>{t("profileLifestyle.title")}</h3>
                  {!lifestyleEditing && (
                    <button type="button" onClick={startLifestyleEdit}>
                      {t("profileLifestyle.edit")}
                    </button>
                  )}
                </div>
                <div className="profile__mini-grid">
                  <section className="profile__mini-card">
                    {lifestyleEditing ? (
                      <ProfileTagEditor
                        externalEditing
                        title={t("profile.favoriteActivities")}
                        tags={lifestyleDraft.favoriteActivities}
                        onChange={(tags) =>
                          setLifestyleDraft((current) => ({
                            ...current,
                            favoriteActivities: tags,
                          }))
                        }
                        maxTags={10}
                        placeholder={t("profileLifestyle.addActivity")}
                        emptyText={t("profileLifestyle.noActivities")}
                        suggestions={ACTIVITY_SUGGESTIONS}
                        formatTag={formatProfileValue}
                      />
                    ) : (
                      <>
                        <h4>
                          <Music size={14} />
                          {t("profile.favoriteActivities")}
                        </h4>
                        {(userProfile.favoriteActivities || []).length >
                        0 ? (
                          <div className="profile__pills">
                            {userProfile.favoriteActivities.map(
                              (item) => (
                                <span key={item} className="profile__pill">
                                  {formatProfileValue(item)}
                                </span>
                              ),
                            )}
                          </div>
                        ) : (
                          <p>{t("profileLifestyle.noActivities")}</p>
                        )}
                      </>
                    )}
                  </section>

                  <section className="profile__mini-card">
                    <h4>{t("profile.socialEnergy")}</h4>
                    {lifestyleEditing ? (
                      <div className="profile__energy-editor">
                        <strong>{lifestyleDraft.socialEnergy ?? 50}%</strong>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={lifestyleDraft.socialEnergy ?? 50}
                          onChange={(event) =>
                            setLifestyleDraft((current) => ({
                              ...current,
                              socialEnergy: Number(event.target.value),
                            }))
                          }
                        />
                        <small>
                          {socialEnergyLabel(lifestyleDraft.socialEnergy ?? 50)}
                        </small>
                      </div>
                    ) : userProfile.socialEnergy != null ? (
                      <div className="profile__energy-ring">
                        <svg viewBox="0 0 36 36">
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            className="profile__ring-bg"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            className="profile__ring-fill"
                            style={{
                              strokeDashoffset:
                                94 * (1 - userProfile.socialEnergy / 100),
                            }}
                          />
                        </svg>
                        <span>{userProfile.socialEnergy}%</span>
                      </div>
                    ) : (
                      <p>{t("profileLifestyle.notSet")}</p>
                    )}
                  </section>

                  <section className="profile__mini-card">
                    <h4>
                      <Coffee size={14} />
                      {t("profile.conversationStyle")}
                    </h4>
                    {lifestyleEditing ? (
                      <select
                        className="profile__lifestyle-select"
                        value={lifestyleDraft.conversationStyle}
                        onChange={(event) =>
                          setLifestyleDraft((current) => ({
                            ...current,
                            conversationStyle: event.target.value,
                          }))
                        }
                      >
                        <option value="">{t("profileLifestyle.notSet")}</option>
                        {CONVERSATION_STYLES.map((style) => (
                          <option key={style} value={style}>
                            {formatProfileValue(style)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p>
                        {userProfile.conversationStyle
                          ? formatProfileValue(
                              userProfile.conversationStyle,
                            )
                          : t("profileLifestyle.notSet")}
                      </p>
                    )}
                  </section>

                  <section className="profile__mini-card">
                    {lifestyleEditing ? (
                      <ProfileTagEditor
                        externalEditing
                        title={t("profile.lookingFor")}
                        tags={lifestyleDraft.lookingFor}
                        onChange={(tags) =>
                          setLifestyleDraft((current) => ({
                            ...current,
                            lookingFor: tags,
                          }))
                        }
                        maxTags={10}
                        placeholder={t("profileLifestyle.addLookingFor")}
                        emptyText={t("profileLifestyle.notSet")}
                        suggestions={LOOKING_FOR_SUGGESTIONS}
                        formatTag={formatProfileValue}
                      />
                    ) : (
                      <>
                        <h4>
                          <Moon size={14} />
                          {t("profile.lookingFor")}
                        </h4>
                        {(userProfile.lookingFor || []).length > 0 ? (
                          <div className="profile__pills">
                            {userProfile.lookingFor.map((item) => (
                              <span key={item} className="profile__pill">
                                {formatProfileValue(item)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p>{t("profileLifestyle.notSet")}</p>
                        )}
                      </>
                    )}
                  </section>
                </div>
                {lifestyleError && (
                  <p className="profile__lifestyle-error">{lifestyleError}</p>
                )}
                {lifestyleEditing && (
                  <div className="profile__lifestyle-actions">
                    <button
                      type="button"
                      onClick={() => setLifestyleEditing(false)}
                      disabled={lifestyleSaving}
                    >
                      {t("common.cancel")}
                    </button>
                    <button
                      type="button"
                      className="saveButton"
                      onClick={saveLifestyle}
                      disabled={lifestyleSaving}
                    >
                      {lifestyleSaving ? t("common.loading") : t("common.save")}
                    </button>
                  </div>
                )}
              </section>

              <DeepPreferencesSection />
              <AvailabilityScheduleEditor />
            </div>
          )}

          {tab === "MATCHES" && (
            <div className="profile__matches-grid">
              {matchesLoading && (
                <div className="profile__matches-state">
                  {t("profile.loadingMatches")}
                </div>
              )}

              {!matchesLoading && matchesError && (
                <div className="profile__matches-state profile__matches-state--error">
                  {t("profileUi.matchesError")}
                </div>
              )}

              {!matchesLoading &&
                !matchesError &&
                profileMatches.length === 0 && (
                  <div className="profile__matches-state">
                    No Quick Match matches yet.
                  </div>
                )}

              {!matchesLoading &&
                !matchesError &&
                profileMatches.map((m) => (
                  <article
                    key={m.id}
                    className="profile__match-card app-tilt-hover"
                  >
                    <div className="profile__match-ring">
                      <UserAvatar
                        className="profile__match-avatar"
                        profilePicture={m.profilePicture}
                        initials={m.initials}
                        alt=""
                      />
                      <span className="profile__match-score">
                        {m.scoreLabel}
                      </span>
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
                            <span>
                              {t("profileUi.more", {
                                count: m.extraInterestsCount,
                              })}
                            </span>
                          )}
                        </>
                      ) : (
                        <em>{t("profile.matchedConnection")}</em>
                      )}
                    </div>
                    {m.isRecentlyActive && (
                      <span className="profile__match-online">
                        {t("profile.recentlyActive")}
                      </span>
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
                  onCancelJoinRequest={() =>
                    handleCancelEventJoinRequest(selectedEvent.id)
                  }
                  onEventUpdated={(updated) => {
                    setSelectedEvent(updated);
                    fetchProfileEvents();
                  }}
                  onSavedChange={(isSaved) =>
                    handleSavedEventChange(selectedEvent.id, isSaved)
                  }
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
                            eventSegment === seg
                              ? "profile__event-seg--active"
                              : ""
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
                      aria-label={t("profileUi.refresh")}
                      aria-busy={eventsLoading}
                      title={t("profileUi.refresh")}
                    >
                      <RefreshCw size={18} aria-hidden="true" />
                    </button>
                  </div>

                  {eventsError && (
                    <div className="profile__events-error">
                      <span>{eventsError}</span>
                      <button type="button" onClick={fetchProfileEvents}>
                        {t("common.retry")}
                      </button>
                    </div>
                  )}

                  {!eventsLoading &&
                    !eventsError &&
                    eventLists[eventSegment].length === 0 && (
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
                        onCancelJoinRequest={() =>
                          handleCancelEventJoinRequest(event.id)
                        }
                        onSavedChange={(isSaved) =>
                          handleSavedEventChange(event.id, isSaved)
                        }
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {followListType && profileUserId && (
        <FollowListModal
          userId={profileUserId}
          currentUserId={profileUserId}
          type={followListType}
          onClose={() => setFollowListType(null)}
        />
      )}
    </div>
  );
}

export function EventDetails({
  event,
  onBack,
  onJoin,
  onCancelJoinRequest,
  onSavedChange,
  onEventUpdated,
}) {
  const { t } = useTranslation();
  return (
    <section className="profile__event-detail">
      <button type="button" className="profile__event-back" onClick={onBack}>
        <ArrowLeft size={16} />
        {t("profileUi.eventBack")}
      </button>
      <div className="profile__event-detail-head">
        <span className="event-card__category">{event.category}</span>
        <h2>{event.title}</h2>
        {event.description && <p>{event.description}</p>}
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
            {event.attendeeCount}/{event.maxAttendees || t("profileUi.open")}{" "}
            {t("profileUi.attending")}
          </span>
          {event.ageLabel && (
            <span>
              <Users size={15} />
              {event.ageLabel}
            </span>
          )}
        </div>
        <div className="profile__event-detail-actions">
          <EventSaveButton
            eventId={event.id}
            isSaved={event.isSaved}
            onChange={onSavedChange}
          />
          <button
            type="button"
            className={`event-card__join${
              event.isJoinedByCurrentUser ? " event-card__join--joined" : ""
            }`}
            onClick={onJoin}
            disabled={
              event.isJoinedByCurrentUser ||
              event.joinRequestStatus === "Pending"
            }
          >
            {event.isJoinedByCurrentUser
              ? t("events.joined").toUpperCase()
              : event.joinRequestStatus === "Pending"
                ? t("events.requestPending").toUpperCase()
                : t("events.join").toUpperCase()}
          </button>
          {event.joinRequestStatus === "Pending" && (
            <button
              type="button"
              className="event-card__cancel-request"
              onClick={onCancelJoinRequest}
            >
              {t("events.cancelRequest")}
            </button>
          )}
          {event.organizerUsername && (
            <span>
              {t("profileUi.hostedBy", { name: event.organizerUsername })}
            </span>
          )}
        </div>
      </div>

      {event.isOrganizer && (
        <EventJoinRequests event={event} onEventUpdated={onEventUpdated} />
      )}
      <EventDiscussion event={event} onJoin={onJoin} />
    </section>
  );
}

function EditableSetting({ icon: Icon, label, value, active, onOpen, children }) {
  const displayValue = label === "Password" || label === "Lozinka" ? "********" : value;
  return (
    <div className={`profile-settings-editable${active ? " is-active" : ""}`}>
      <button
        type="button"
        className="profile-settings-editable__summary"
        onClick={onOpen}
        aria-expanded={active}
      >
        <Icon size={16} />
        <div>
          <strong>{label}</strong>
          <span>{displayValue}</span>
        </div>
        <small>{active ? "Editing" : "Edit"}</small>
      </button>
      {active && (
        <div className="profile-settings-editable__form">
          {children}
        </div>
      )}
    </div>
  );
}

function SettingActions({ saving, disabled = false, disabledReason = "", onSave, onCancel }) {
  return (
    <div className="profile-settings-editable__actions">
      <button
        type="button"
        className="profile__quiet-btn"
        onClick={onCancel}
        disabled={saving}
      >
        Cancel
      </button>
      <button
        type="button"
        className="app-btn-pill"
        onClick={onSave}
        disabled={saving || disabled}
        title={!saving && disabledReason ? disabledReason : undefined}
      >
        {saving ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

function formatVisibilityLabel(value) {
  switch (value) {
    case "Public":
      return "Public";
    case "Private":
      return "Private";
    default:
      return "Standard";
  }
}


function EventDiscussion({ event, onJoin }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStatus, setLoadStatus] = useState("idle");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [blockedAuthors, setBlockedAuthors] = useState(() => new Set());
  const messagesRef = useRef(null);

  const loadDiscussion = useCallback(
    async ({ silent = false } = {}) => {
      const eventId = Number(event.id);

      if (!isValidEventId(eventId)) {
        setMessages([]);
        setLoadStatus("error");
        setError(
          "Event discussion could not be loaded because the event database id is missing.",
        );
        return;
      }

      if (!event.isJoinedByCurrentUser) {
        setMessages([]);
        setLoadStatus("idle");
        setError("");
        return;
      }

      if (!silent) {
        setLoading(true);
        setLoadStatus("loading");
        setError("");
      }

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
        const nextMessages = Array.isArray(data) ? [...data] : [];
        nextMessages.sort((first, second) => {
          const timeDifference =
            new Date(first.createdAt ?? first.CreatedAt ?? 0) -
            new Date(second.createdAt ?? second.CreatedAt ?? 0);
          return (
            timeDifference ||
            Number(first.id ?? first.Id ?? 0) -
              Number(second.id ?? second.Id ?? 0)
          );
        });
        setMessages(nextMessages);
        setLoadStatus("success");
        setError("");
      } catch (loadError) {
        console.error("[Event Discussion] load failed", loadError);
        setError(loadError.message || "Event discussion could not be loaded.");
        setLoadStatus("error");
      } finally {
        setLoading(false);
      }
    },
    [event.id, event.isJoinedByCurrentUser],
  );

  useEffect(() => {
    loadDiscussion();
    if (!event.isJoinedByCurrentUser) return undefined;
    const intervalId = window.setInterval(
      () => loadDiscussion({ silent: true }),
      3000,
    );
    return () => window.clearInterval(intervalId);
  }, [event.isJoinedByCurrentUser, loadDiscussion]);

  useEffect(() => {
    if (!messagesRef.current) return;
    messagesRef.current.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const handleSend = async (text = draft) => {
    const eventId = Number(event.id);
    const body = text.trim();
    if (!body || sending) return;

    if (!isValidEventId(eventId)) {
      setError(
        "Message could not be sent because the event database id is missing.",
      );
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
        throw new Error(
          getDiscussionErrorMessage(response.status, responseBody),
        );
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

  const sendAttachment = async (file, text, onProgress) => {
    const eventId = Number(event.id);
    setSending(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      if (text.trim()) form.append("body", text.trim());
      const sent = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `/api/Events/${eventId}/discussion/attachments`);
        xhr.setRequestHeader(
          "Authorization",
          `Bearer ${localStorage.getItem("token")}`,
        );
        xhr.upload.onprogress = (e) =>
          e.lengthComputable &&
          onProgress?.(Math.round((e.loaded * 100) / e.total));
        xhr.onload = () =>
          xhr.status >= 200 && xhr.status < 300
            ? resolve(JSON.parse(xhr.responseText))
            : reject(new Error(xhr.responseText || "Upload failed."));
        xhr.onerror = () => reject(new Error("Upload failed."));
        xhr.send(form);
      });
      setMessages((current) => [...current, sent]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };
  const sendGif = async (gif) => {
    const eventId = Number(event.id);
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/Events/${eventId}/discussion/gifs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(gif),
      });
      if (!response.ok) throw new Error(await response.text());
      const sent = await response.json();
      setMessages((current) => [...current, sent]);
      setDraft("");
    } finally {
      setSending(false);
    }
  };

  if (!event.isJoinedByCurrentUser) {
    return (
      <section className="profile__event-thread profile__event-thread--locked">
        <h3>{t("profile.eventDiscussion")}</h3>
        <p>{t("profile.joinDiscussion")}</p>
        <button type="button" className="app-btn-pill" onClick={onJoin}>
          {t("profileUi.joinDiscuss")}
        </button>
      </section>
    );
  }

  return (
    <section className="profile__event-thread">
      <div className="profile__event-thread-head">
        <div>
          <h3>{t("profile.eventDiscussion")}</h3>
          <p>{t("profile.eventMessages")}</p>
        </div>
        <button
          type="button"
          className="profile__quiet-btn"
          onClick={loadDiscussion}
        >
          {t("profileUi.refresh")}
        </button>
      </div>

      {loading && (
        <div className="profile__events-empty">
          {t("profile.loadingDiscussion")}
        </div>
      )}
      {loadStatus === "error" && (
        <div className="profile__events-error">
          <span>{error}</span>
          <button
            type="button"
            className="profile__quiet-btn"
            onClick={() => loadDiscussion()}
          >
            {t("chat.retry")}
          </button>
        </div>
      )}
      {error && loadStatus !== "error" && (
        <div className="profile__events-error">{error}</div>
      )}

      <div className="profile__event-messages" ref={messagesRef}>
        {loadStatus === "success" && messages.length === 0 && (
          <div className="profile__events-empty">{t("chat.noMessages")}</div>
        )}
        {messages.map((message) => {
          const mine = Boolean(message.isMine);
          const authorBlocked = blockedAuthors.has(Number(message.userId));

          return (
            <div
              key={message.id}
              className={`profile__event-message${
                mine ? " profile__event-message--mine" : ""
              }`}
            >
              {!mine && (
                <div className="profile__event-message-author">
                  <span>
                    {message.displayName ||
                      message.username ||
                      t("profileUi.member")}
                  </span>
                  <UserActionsMenu
                    userId={message.userId}
                    username={
                      message.username || message.displayName || "member"
                    }
                    context="eventDiscussion"
                    allowHide={false}
                    onBlocked={(id) =>
                      setBlockedAuthors((current) =>
                        new Set(current).add(Number(id)),
                      )
                    }
                  />
                </div>
              )}
              {!authorBlocked && !message.isDeleted && (
                <AttachmentView attachment={message.attachment} />
              )}
              {(authorBlocked || message.isDeleted || message.body) && (
                <p>
                  {authorBlocked
                    ? "Comment from blocked user hidden"
                    : message.isDeleted
                      ? t("profileUi.deletedMessage")
                      : message.body}
                </p>
              )}
              <small>{formatChatTime(message.createdAt)}</small>
            </div>
          );
        })}
      </div>

      <ChatComposer
        value={draft}
        onChange={setDraft}
        sending={sending}
        placeholder={t("profileUi.writeDiscussion")}
        onSendText={handleSend}
        onSendAttachment={sendAttachment}
        onSendGif={sendGif}
      />
    </section>
  );
}

function EventJoinRequests({ event, onEventUpdated }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [respondingId, setRespondingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/Events/${event.id}/join-requests`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok)
        throw new Error(
          (await response.text()) || t("events.joinRequestsError"),
        );
      const data = await response.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError.message || t("events.joinRequestsError"));
    } finally {
      setLoading(false);
    }
  }, [event.id, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const syncRequest = (changeEvent) => {
      const detail = changeEvent.detail;
      if (Number(detail?.eventId) !== Number(event.id)) return;
      setRequests((current) =>
        current.filter((request) => request.id !== detail.requestId),
      );
      if (detail.event) onEventUpdated?.(mapApiEvent(detail.event));
      else load();
    };
    window.addEventListener(EVENT_JOIN_REQUEST_CHANGED_EVENT, syncRequest);
    return () =>
      window.removeEventListener(EVENT_JOIN_REQUEST_CHANGED_EVENT, syncRequest);
  }, [event.id, load, onEventUpdated]);

  const respond = async (requestId, action) => {
    if (respondingId) return;
    setRespondingId(requestId);
    setError("");
    try {
      const response = await fetch(
        `/api/Events/${event.id}/join-requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        },
      );
      if (!response.ok)
        throw new Error(
          (await response.text()) || t("events.joinRequestActionError"),
        );
      const updated = mapApiEvent(await response.json());
      setRequests((current) =>
        current.filter((request) => request.id !== requestId),
      );
      onEventUpdated?.(updated);
      announceEventJoinRequestChanged({
        eventId: event.id,
        requestId,
        status: action === "accept" ? "Accepted" : "Rejected",
        event: updated,
      });
    } catch (requestError) {
      setError(requestError.message || t("events.joinRequestActionError"));
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <section className="profile__join-requests">
      <header>
        <div>
          <h3>{t("events.joinRequests")}</h3>
          <p>{t("events.joinRequestsHelp")}</p>
        </div>
        <span>{requests.length}</span>
      </header>
      {loading && (
        <div className="profile__events-empty">{t("common.loading")}</div>
      )}
      {!loading && error && (
        <div className="profile__events-error">{error}</div>
      )}
      {!loading && !error && requests.length === 0 && (
        <div className="profile__events-empty">
          {t("events.noJoinRequests")}
        </div>
      )}
      {!loading &&
        requests.map((request) => (
          <div className="profile__join-request" key={request.id}>
            <button
              type="button"
              className="profile__join-request-avatar"
              aria-label={t("notifications.openProfile")}
              onClick={() => navigate(`/app/users/${request.userId}`)}
            >
              <UserAvatar
                className="profile__join-request-avatar-image"
                profilePicture={request.profilePicture}
                initials={(request.username || "MY").slice(0, 2).toUpperCase()}
                alt={request.username}
              />
            </button>
            <button
              type="button"
              className="profile__join-request-user"
              onClick={() => navigate(`/app/users/${request.userId}`)}
            >
              <strong>{request.displayName || request.username}</strong>
              <small>@{request.username}</small>
            </button>
            <span>
              <button
                type="button"
                disabled={respondingId === request.id}
                onClick={() => respond(request.id, "accept")}
              >
                {t("notifications.accept")}
              </button>
              <button
                type="button"
                disabled={respondingId === request.id}
                onClick={() => respond(request.id, "reject")}
              >
                {t("events.reject")}
              </button>
            </span>
          </div>
        ))}
    </section>
  );
}

function formatAgeLimit(minAge, maxAge) {
  if (minAge != null && maxAge != null) return `Ages ${minAge}–${maxAge}`;
  if (minAge != null) return `${minAge}+`;
  if (maxAge != null) return `Up to ${maxAge}`;
  return "";
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
    description: event.description ?? event.Description ?? "",
    attendees:
      event.participantAvatars ??
      event.ParticipantAvatars ??
      event.participantInitials ??
      event.ParticipantInitials ??
      [],
    attendeeCount: event.participantsCount ?? event.ParticipantsCount ?? 0,
    maxAttendees: event.maxAttendees ?? event.MaxAttendees ?? 0,
    minAge: event.minAge ?? event.MinAge ?? null,
    maxAge: event.maxAge ?? event.MaxAge ?? null,
    ageLabel: formatAgeLimit(
      event.minAge ?? event.MinAge,
      event.maxAge ?? event.MaxAge,
    ),
    isJoinedByCurrentUser: Boolean(
      event.isJoinedByCurrentUser ?? event.IsJoinedByCurrentUser,
    ),
    isOrganizer: Boolean(event.isOrganizer ?? event.IsOrganizer),
    requiresParticipantApproval: Boolean(
      event.requiresParticipantApproval ?? event.RequiresParticipantApproval,
    ),
    joinRequestStatus:
      event.joinRequestStatus ?? event.JoinRequestStatus ?? null,
    pendingJoinRequestsCount:
      event.pendingJoinRequestsCount ?? event.PendingJoinRequestsCount ?? 0,
    createdByUserId: event.createdByUserId ?? event.CreatedByUserId,
    isSaved: Boolean(event.isSaved ?? event.IsSaved),
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
  const compatibilityScore =
    match.compatibilityScore ?? match.CompatibilityScore ?? null;

  return {
    id: match.userId ?? match.UserId,
    username: match.username ?? match.Username ?? name,
    name,
    initials: match.initials ?? match.Initials ?? getInitials(name),
    profilePicture: match.profilePicture ?? match.ProfilePicture ?? null,
    compatibility:
      compatibilityScore == null ? null : Number(compatibilityScore) || 0,
    scoreLabel:
      compatibilityScore == null
        ? "Matched"
        : `${Number(compatibilityScore) || 0}%`,
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
    isRecentlyActive: Boolean(
      match.isRecentlyActive ?? match.IsRecentlyActive ?? match.activeToday,
    ),
  };
}

function toDateInputValue(value) {
  if (!value || typeof value !== "string") return "";
  return value.split("T")[0];
}

function getPasswordFormError(passwordDraft) {
  if (!passwordDraft.currentPassword.trim()) return "Current password is required.";
  if (!passwordDraft.newPassword.trim()) return "New password is required.";
  if (!passwordDraft.confirmNewPassword.trim())
    return "Confirm new password is required.";
  if (passwordDraft.newPassword !== passwordDraft.confirmNewPassword)
    return "Passwords do not match.";

  return getPasswordValidationMessage(passwordDraft.newPassword);
}

function getEmailChangeRequestError(emailDraft, passwordDraft) {
  const email = emailDraft.trim();
  if (!email) return "Enter a valid email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return "Enter a valid email address.";
  if (!passwordDraft.trim()) return "Current password is required.";
  return "";
}

function getEmailChangeErrorMessage(error) {
  const message = String(error?.message || "").trim();
  const normalized = message.toLowerCase();

  if (
    normalized.includes("trenutna lozinka") ||
    normalized.includes("current password") ||
    normalized.includes("incorrect")
  ) {
    return "Current password is incorrect.";
  }

  if (
    normalized.includes("vec u upotrebi") ||
    normalized.includes("already") ||
    normalized.includes("in use")
  ) {
    return "This email is already in use.";
  }

  if (
    normalized.includes("invalid or expired") ||
    normalized.includes("verification code")
  ) {
    return "Invalid or expired verification code.";
  }

  if (
    normalized.includes("format") ||
    normalized.includes("valid email") ||
    normalized.includes("email is required")
  ) {
    return "Enter a valid email address.";
  }

  return message || "Email could not be changed. Please try again.";
}

function getPasswordChangeErrorMessage(error) {
  const message = String(error?.message || "").trim();
  const normalized = message.toLowerCase();

  if (
    normalized.includes("trenutna lozinka") ||
    normalized.includes("current password") ||
    normalized.includes("incorrect")
  ) {
    return "Current password is incorrect.";
  }

  if (
    normalized.includes("weak_password") ||
    normalized.includes("at least 8 characters") ||
    normalized.includes("uppercase")
  ) {
    return PASSWORD_POLICY_MESSAGE;
  }

  if (
    normalized.includes("ne poklapaju") ||
    normalized.includes("do not match")
  ) {
    return "Passwords do not match.";
  }

  return message || "Password could not be changed. Please try again.";
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
  if (status === 404)
    return "Event discussion could not be loaded. Event was not found.";
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
