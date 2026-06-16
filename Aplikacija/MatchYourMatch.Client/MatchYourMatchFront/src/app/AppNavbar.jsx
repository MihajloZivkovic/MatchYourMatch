import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Menu, Monitor, Moon, Sun, X } from "lucide-react";
import GlobalSearch from "../components/GlobalSearch";
import { useTheme } from "../context/ThemeContext";
import "./AppNavbar.css";

function AppNavbar(props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const themeRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(e.target)) {
        setThemeMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("mym_authed");
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("tokenChanged"));
    navigate("/");
  };

  const navLinkClass = ({ isActive }) =>
    `app-navbar__link${isActive ? " app-navbar__link--active" : ""}`;
  const ThemeIcon = theme === "system" ? Monitor : resolvedTheme === "light" ? Sun : Moon;

  return (
    <header className="app-navbar">
      <nav className="app-navbar__inner">
        <Link to="/app/dashboard" className="app-navbar__logo">
          <span className="app-navbar__logo-m">M</span>
          <span className="app-navbar__logo-accent">Y</span>
          <span className="app-navbar__logo-m">M</span>
        </Link>

        <div className="app-navbar__search">
          <GlobalSearch />
        </div>

        <div className="app-navbar__center">
          <NavLink to="/app/quick-match" className={navLinkClass}>
            QUICK MATCH
          </NavLink>
          <NavLink to="/app/deep-match" className={navLinkClass}>
            DEEP MATCH
          </NavLink>
          <NavLink to="/app/events" className={navLinkClass}>
            EVENTS
          </NavLink>
          <NavLink to="/app/chat" className={navLinkClass}>
            CHAT
          </NavLink>
        </div>

        <div className="app-navbar__right">
          <Link to="/app/events/create" className="app-navbar__create">
            + CREATE EVENT
          </Link>

          <div className="app-navbar__profile-wrap" ref={dropdownRef}>
            <button
              type="button"
              className="app-navbar__avatar"
              aria-label="Profile menu"
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((o) => !o)}
            >
              {props.picture ? <img src={props.picture} alt="profile picture" className="profilePicture"/> : null}
            </button>
            {dropdownOpen && (
              <div className="app-navbar__dropdown">
                <Link to="/app/profile" onClick={() => setDropdownOpen(false)}>
                  My Profile
                </Link>
                <button type="button" className="app-navbar__dropdown-muted">
                  Settings
                </button>
                <button type="button" onClick={handleLogout}>
                  Logout
                </button>
              </div>
            )}
          </div>

          <div className="app-navbar__theme" ref={themeRef}>
            <button
              type="button"
              className="app-navbar__theme-btn"
              aria-label="Theme"
              aria-expanded={themeMenuOpen}
              onClick={() => setThemeMenuOpen((open) => !open)}
            >
              <ThemeIcon size={17} />
              <span>Theme</span>
            </button>
            {themeMenuOpen && (
              <div className="app-navbar__theme-menu">
                <button
                  type="button"
                  className={theme === "system" ? "app-navbar__theme-option--active" : ""}
                  onClick={() => {
                    setTheme("system");
                    setThemeMenuOpen(false);
                  }}
                >
                  <Monitor size={15} />
                  System
                </button>
                <button
                  type="button"
                  className={theme === "light" ? "app-navbar__theme-option--active" : ""}
                  onClick={() => {
                    setTheme("light");
                    setThemeMenuOpen(false);
                  }}
                >
                  <Sun size={15} />
                  Light
                </button>
                <button
                  type="button"
                  className={theme === "dark" ? "app-navbar__theme-option--active" : ""}
                  onClick={() => {
                    setTheme("dark");
                    setThemeMenuOpen(false);
                  }}
                >
                  <Moon size={15} />
                  Dark
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="app-navbar__hamburger"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </nav>

      <div
        className={`app-navbar__drawer${menuOpen ? " app-navbar__drawer--open" : ""}`}
      >
        <div className="app-navbar__drawer-search">
          <GlobalSearch onNavigate={() => setMenuOpen(false)} />
        </div>

        <NavLink
          to="/app/quick-match"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          QUICK MATCH
        </NavLink>
        <NavLink
          to="/app/deep-match"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          DEEP MATCH
        </NavLink>
        <NavLink
          to="/app/events"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          EVENTS
        </NavLink>
        <NavLink
          to="/app/chat"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          CHAT
        </NavLink>
        <Link
          to="/app/events/create"
          className="app-navbar__drawer-create"
          onClick={() => setMenuOpen(false)}
        >
          + CREATE EVENT
        </Link>
        <Link
          to="/app/profile"
          className="app-navbar__drawer-link"
          onClick={() => setMenuOpen(false)}
        >
          My Profile
        </Link>
        <div className="app-navbar__drawer-theme">
          <span>Theme</span>
          <div>
            {["system", "light", "dark"].map((option) => (
              <button
                key={option}
                type="button"
                className={theme === option ? "app-navbar__drawer-theme-active" : ""}
                onClick={() => setTheme(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="app-navbar__drawer-logout"
          onClick={handleLogout}
        >
          Logout
        </button>
      </div>
      {menuOpen && (
        <button
          type="button"
          className="app-navbar__overlay"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}

export default AppNavbar;
