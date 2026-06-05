import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { CURRENT_USER } from "../data/matches";
import "./AppNavbar.css";

function AppNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
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

  return (
    <header className="app-navbar">
      <nav className="app-navbar__inner">
        <Link to="/app/dashboard" className="app-navbar__logo">
          <span className="app-navbar__logo-m">M</span>
          <span className="app-navbar__logo-accent">Y</span>
          <span className="app-navbar__logo-m">M</span>
        </Link>

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
              {CURRENT_USER.initials}
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
