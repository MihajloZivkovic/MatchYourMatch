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
import AppShell from "./app/AppShell";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
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
  });
  const exitTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");

  async function getFullName() {
    const token = localStorage.getItem("token");
    const response = await fetch("/api/UserProfile/me", {
      method: "GET",
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

    const refreshCurrentUser = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        if (mounted) setCurrentUser("");
        return;
      }

      try {
        const id = getId();
        if (!id) {
          if (mounted) setCurrentUser("");
          return;
        }
        const data = await getFullName();
        if (mounted) setCurrentUser(data);
      } catch (err) {
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
      window.removeEventListener("tokenChanged", onTokenChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadUserProfile = async () => {
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
          });
        }
        return;
      }

      try {
        const response = await fetch("/api/UserProfile/me", {
          headers: {
            accept: "*/*",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) return;

        const data = await response.json();
        if (mounted) {
          setUserProfile({
            bio: data.bio ?? "",
            location: data.location ?? "",
            profilePicture: data.profilePicture ?? "",
            matchesCount: data.matchesCount ?? null,
            eventsJoinedCount: data.eventsJoinedCount ?? null,
            profileScorePercent: data.profileScorePercent ?? null,
            responseRatePercent: data.responseRatePercent ?? null,
          });
        }
      } catch (error) {
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
      window.removeEventListener("tokenChanged", onTokenChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === "/") {
      setIsExiting(false);
    }
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
      <Routes>
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppShell userProfile = {userProfile}/>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route
            path="dashboard"
            element={<Dashboard currentUser={currentUser} />}
          />
          <Route path="quick-match" element={<QuickMatch />} />
          <Route path="deep-match" element={<DeepMatch />} />
          <Route path="events" element={<Events />} />
          <Route path="events/create" element={<CreateEvent />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="users/:id" element={<PublicProfile />} />
          <Route path="chat" element={<Chat />} />
          <Route
            path="profile"
            element={<Profile currentUser={currentUser} userProfile = {userProfile} setUserProfile = {setUserProfile}/>}
          />
        </Route>
      </Routes>
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
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
  );
}

export default App;
