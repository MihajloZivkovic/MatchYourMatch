import { useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import GlobalSearch from "../components/GlobalSearch";
import NotificationsDropdown from "../components/notifications/NotificationsDropdown";
import ThemeMenu from "../components/ThemeMenu";
import { useTranslation } from "../hooks/useTranslation";
import { logoutAndRedirect } from "../services/authSession";
import "./AppNavbar.css";

function AppNavbar(props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();

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
    setMenuOpen(false);
    setDropdownOpen(false);
    logoutAndRedirect(navigate);
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

        <div className="app-navbar__search">
          <GlobalSearch />
        </div>

        <div className="app-navbar__center">
          <NavLink to="/app/quick-match" className={navLinkClass}>
            {t('nav.quickMatch').toUpperCase()}
          </NavLink>
          <NavLink to="/app/deep-match" className={navLinkClass}>
            {t('nav.deepMatch').toUpperCase()}
          </NavLink>
          <NavLink to="/app/events" className={navLinkClass}>
            {t('nav.events').toUpperCase()}
          </NavLink>
          <NavLink to="/app/chat" className={navLinkClass}>
            {t('nav.chat').toUpperCase()}
          </NavLink>
        </div>

        <div className="app-navbar__right">
          <ThemeMenu variant="app" />

          <Link to="/app/events/create" className="app-navbar__create">
            + {t('nav.createEvent').toUpperCase()}
          </Link>

          <NotificationsDropdown />

          <div className="app-navbar__profile-wrap" ref={dropdownRef}>
            <button
              type="button"
              className="app-navbar__avatar"
              aria-label={t('nav.profileMenu')}
              aria-expanded={dropdownOpen}
              onClick={() => setDropdownOpen((o) => !o)}
            >
              {props.picture ? <img src={props.picture} alt="profile picture" className="profilePicture"/> : null}
            </button>
            {dropdownOpen && (
              <div className="app-navbar__dropdown">
                <Link to="/app/profile" onClick={() => setDropdownOpen(false)}>
                  {t('nav.myProfile')}
                </Link>
                <Link to="/app/settings" onClick={() => setDropdownOpen(false)}>
                  {t('nav.settings')}
                </Link>
                <button type="button" onClick={handleLogout}>
                  {t('nav.logout')}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            className="app-navbar__hamburger"
            aria-label={menuOpen ? t('nav.closeMenu') : t('nav.openMenu')}
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

        <NotificationsDropdown mobile onNavigate={() => setMenuOpen(false)} />

        <NavLink
          to="/app/quick-match"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.quickMatch').toUpperCase()}
        </NavLink>
        <NavLink
          to="/app/deep-match"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.deepMatch').toUpperCase()}
        </NavLink>
        <NavLink
          to="/app/events"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.events').toUpperCase()}
        </NavLink>
        <NavLink
          to="/app/chat"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.chat').toUpperCase()}
        </NavLink>
        <Link
          to="/app/events/create"
          className="app-navbar__drawer-create"
          onClick={() => setMenuOpen(false)}
        >
          + {t('nav.createEvent').toUpperCase()}
        </Link>
        <Link
          to="/app/profile"
          className="app-navbar__drawer-link"
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.myProfile')}
        </Link>
        <Link
          to="/app/settings"
          className="app-navbar__drawer-link"
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.settings')}
        </Link>
        <ThemeMenu variant="app" layout="drawer" />
        <button
          type="button"
          className="app-navbar__drawer-logout"
          onClick={handleLogout}
        >
          {t('nav.logout')}
        </button>
      </div>
      {menuOpen && (
        <button
          type="button"
          className="app-navbar__overlay"
          aria-label={t('nav.closeMenu')}
          onClick={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
}

export default AppNavbar;
