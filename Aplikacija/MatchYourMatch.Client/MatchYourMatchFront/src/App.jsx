import { useState, useEffect, useCallback, useRef } from "react";
import {
  Routes,
  Route,
  useNavigate,
  useLocation,
  Navigate,
} from "react-router-dom";
import {jwtDecode} from "jwt-decode";
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
import "./App.css";

function App() {
  const [isExiting, setIsExiting] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const exitTimerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const isAppRoute = location.pathname.startsWith("/app");

  async function getFullName(id) {
    const response = await fetch(`/api/UserProfile/${id}`, {
      method: "GET",
      headers: { accept: "*/*" },
    });
    const data = await response.json();
    return data;
  }

  function getId() {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const decoded = jwtDecode(token);
    const userId =
      decoded[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier"
      ];
    return userId;
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
        const data = await getFullName(id);
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
              <AppShell />
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
          <Route
            path="profile"
            element={<Profile currentUser={currentUser} />}
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

      <Navbar isExiting={isExiting} onAboutClick={handleAboutClick} />
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
