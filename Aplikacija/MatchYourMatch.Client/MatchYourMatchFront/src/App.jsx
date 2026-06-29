import { useState, useEffect, useCallback, useRef } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoute from "./components/AdminRoute";
import AppShell from "./app/AppShell";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import VerifyEmail from "./pages/VerifyEmail";
import CompleteProfile from "./pages/CompleteProfile";
import About from "./pages/About";
import Dashboard from "./pages/app/Dashboard";
import QuickMatch from "./pages/app/QuickMatch";
import DeepMatch from "./pages/app/DeepMatch";
import Events from "./pages/app/Events";
import CreateEvent from "./pages/app/CreateEvent";
import Profile from "./pages/app/Profile";
import SearchResults from "./pages/app/SearchResults";
import PublicProfile from "./pages/app/PublicProfile";
import Chat from "./pages/app/Chat";
import Settings from "./pages/app/Settings";
import AdminDashboard from "./pages/admin/AdminDashboard";
import SessionExpiredModal from "./components/SessionExpiredModal";
import { getGuestCity, isGuestSession, isOrganizerSession } from "./services/guestSession";
import "./App.css";

const USER_ID_CLAIMS = [
  "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
  "nameid",
  "sub",
  "userId",
  "userid",
  "id",
];

function App() {
  const [isExiting, setIsExiting] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [userProfile, setUserProfile] = useState({
    bio: "",
    profilePicture: null,
    location: "",
    matchesCount: null,
    eventsJoinedCount: null,
    profileScorePercent: null,
    responseRatePercent: null,
    pendingEmail: "",
    profileVisibility: "Standard",
    fullName: "",
    showFullName: false,
    dateOfBirth: "",
    showAge: false,
    age: null,
    littleThings: [],
    currentlyExploring: [],
    favoriteActivities: [],
    socialEnergy: null,
    conversationStyle: "",
    lookingFor: [],
  });
  const exitTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");
  const isAdminRoute = location.pathname.startsWith("/admin");

  async function getFullName(token, signal) {
    const response = await fetch("/api/UserProfile/me", {
      method: "GET",
      signal,
      headers: {
        accept: "*/*",
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json();
    return data;
  }

  function getId() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const decoded = jwtDecode(token);
    return USER_ID_CLAIMS.map((claim) => decoded[claim]).find(Boolean) || null;
  }

  useEffect(() => {
    let mounted = true;
    let activeController = null;

    const refreshCurrentUser = async () => {
      activeController?.abort();
      const token = localStorage.getItem("token");
      if (!token) {
        if (mounted) setCurrentUser("");
        return;
      }

      if (isGuestSession(token)) {
        if (mounted) {
          setCurrentUser({
            id: "guest",
            username: "Guest",
            role: "Guest",
            userType: "Guest",
            city: getGuestCity(token),
          });
        }
        return;
      }

      try {
        const id = getId();
        if (!id) {
          if (mounted) setCurrentUser("");
          return;
        }
        activeController = new AbortController();
        const data = await getFullName(token, activeController.signal);
        if (mounted && localStorage.getItem("token") === token) setCurrentUser(data);
      } catch (err) {
        if (err.name === 'AbortError') return;
        if (mounted) setCurrentUser("");
        console.log(err);
      }
    };

    // na prvo pokretanje i kad se login/logout
    refreshCurrentUser();

    const onTokenChanged = () => refreshCurrentUser();
    window.addEventListener("tokenChanged", onTokenChanged);

    // slusa za promenu tabova
    const onStorage = (e) => {
      if (e.key === "token") refreshCurrentUser();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mounted = false;
      activeController?.abort();
      window.removeEventListener("tokenChanged", onTokenChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    let activeController = null;

    const loadUserProfile = async () => {
      activeController?.abort();
      const token = localStorage.getItem("token");
      if (!token) {
        if (mounted) {
          setUserProfile({
            bio: "",
            profilePicture: "",
            location: "",
            matchesCount: null,
            eventsJoinedCount: null,
            profileScorePercent: null,
            responseRatePercent: null,
            pendingEmail: "",
            profileVisibility: "Standard",
            fullName: "",
            showFullName: false,
            dateOfBirth: "",
            showAge: false,
            age: null,
            littleThings: [],
            currentlyExploring: [],
            favoriteActivities: [],
            socialEnergy: null,
            conversationStyle: "",
            lookingFor: [],
          });
        }
        return;
      }

      if (isGuestSession(token)) {
        if (mounted) {
          setUserProfile((current) => ({
            ...current,
            profilePicture: "",
            location: getGuestCity(token),
          }));
        }
        return;
      }

      try {
        activeController = new AbortController();
        const response = await fetch("/api/UserProfile/me", {
          signal: activeController.signal,
          headers: {
            accept: "*/*",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (mounted && localStorage.getItem("token") === token) {
          setUserProfile({
            bio: data.bio ?? "",
            location: data.location ?? "",
            profilePicture: data.profilePicture ?? "",
            matchesCount: data.matchesCount ?? null,
            eventsJoinedCount: data.eventsJoinedCount ?? null,
            profileScorePercent: data.profileScorePercent ?? null,
            responseRatePercent: data.responseRatePercent ?? null,
            pendingEmail: data.pendingEmail ?? "",
            profileVisibility: data.profileVisibility ?? "Standard",
            fullName: data.fullName ?? "",
            showFullName: Boolean(data.showFullName),
            dateOfBirth: data.dateOfBirth ?? "",
            showAge: Boolean(data.showAge),
            age: data.age ?? null,
            littleThings: Array.isArray(data.littleThings) ? data.littleThings : [],
            currentlyExploring: Array.isArray(data.currentlyExploring) ? data.currentlyExploring : [],
            favoriteActivities: Array.isArray(data.favoriteActivities) ? data.favoriteActivities : [],
            socialEnergy: typeof data.socialEnergy === "number" ? data.socialEnergy : null,
            conversationStyle: data.conversationStyle || "",
            lookingFor: Array.isArray(data.lookingFor) ? data.lookingFor : [],
          });
        }
      } catch (error) {
        if (error.name === 'AbortError') return;
        console.error("Failed to load user profile:", error);
      }
    };

    // Load profile on first load and when token changes
    loadUserProfile();

    const onTokenChanged = () => loadUserProfile();
    window.addEventListener("tokenChanged", onTokenChanged);

    const onStorage = (e) => {
      if (e.key === "token") loadUserProfile();
    };
    window.addEventListener("storage", onStorage);

    return () => {
      mounted = false;
      activeController?.abort();
      window.removeEventListener("tokenChanged", onTokenChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === "/") {
      const resetExit = window.setTimeout(() => setIsExiting(false), 0);
      return () => window.clearTimeout(resetExit);
    }
    return undefined;
  }, [location.pathname]);

  useEffect(() => {
    return () => {
      if (exitTimerRef.current) {
        clearTimeout(exitTimerRef.current);
      }
    };
  }, []);

  const handleAboutClick = useCallback(
    (e) => {
      e.preventDefault();
      if (location.pathname === "/") {
        setIsExiting(true);
        exitTimerRef.current = setTimeout(() => {
          setIsExiting(false);
          navigate("/about");
        }, 700);
      } else {
        navigate("/about");
      }
    },
    [location.pathname, navigate],
  );

  if (isAppRoute) {
    return (
      <><Routes>
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell userProfile = {userProfile} currentUser={currentUser}/>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={isGuestSession() ? "events" : "dashboard"} replace />} />
          <Route
            path="dashboard"
            element={<Dashboard currentUser={currentUser} />}
          />
          <Route path="quick-match" element={<QuickMatch />} />
          <Route path="deep-match" element={<DeepMatch />} />
          <Route path="events" element={<Events currentUser={currentUser} />} />
          <Route
            path="events/create"
            element={
              <OrganizerEventRoute>
                <CreateEvent />
              </OrganizerEventRoute>
            }
          />
          <Route path="events/:id/edit" element={<CreateEvent />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="users/:id" element={<PublicProfile />} />
          <Route path="chat" element={<Chat />} />
          <Route path="settings" element={<Settings />} />
          <Route
            path="profile"
            element={<Profile currentUser={currentUser} userProfile = {userProfile} setUserProfile = {setUserProfile}/>}
          />
        </Route>
      </Routes><SessionExpiredModal /></>
    );
  }

  if (isAdminRoute) {
    return (
      <><Routes>
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route
          path="/admin/dashboard"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
      </Routes><SessionExpiredModal /></>
    );
  }

  return (
    <div className="page">
      <div className="page__bg" aria-hidden="true">
        <div className="page__gradient" />
        <div className="page__noise" />
      </div>

      <Navbar isExiting={isExiting} onAboutClick={handleAboutClick}/>
      <Routes>
        <Route path="/" element={<Home isExiting={isExiting} />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/about" element={<About />} />
      </Routes>
      <SessionExpiredModal />
    </div>
  );
}

function OrganizerEventRoute({ children }) {
  const location = useLocation();

  if (!isOrganizerSession()) {
    return (
      <Navigate
        to="/app/events"
        replace
        state={{ organizerOnly: true, from: location.pathname }}
      />
    );
  }

  return children;
}

export default App;
