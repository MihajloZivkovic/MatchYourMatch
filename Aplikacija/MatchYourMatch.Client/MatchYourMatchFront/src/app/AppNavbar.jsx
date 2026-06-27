import { useCallback, useState, useEffect, useRef } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import GlobalSearch from "../components/GlobalSearch";
import NotificationsDropdown from "../components/notifications/NotificationsDropdown";
import ThemeMenu from "../components/ThemeMenu";
import { useTranslation } from "../hooks/useTranslation";
import { logoutAndRedirect } from "../services/authSession";
import { isGuestSession } from "../services/guestSession";
import { notificationService, NOTIFICATIONS_CHANGED_EVENT } from "../services/notificationService";
import "./AppNavbar.css";

function AppNavbar(props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationUnread, setNotificationUnread] = useState(0);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isGuest = props.currentUser?.role === "Guest" || isGuestSession();

  const loadUnreadNotifications = useCallback(async () => {
    if (isGuest) {
      setNotificationUnread(0);
      return;
    }
    if (!localStorage.getItem('token')) {
      setNotificationUnread(0);
      return;
    }
    try {
      const data = await notificationService.unreadCount();
      setNotificationUnread(Math.max(0, Number(data?.count) || 0));
    } catch { /* Session handling owns 401; polling stays quiet. */ }
  }, [isGuest]);

  useEffect(() => {
    loadUnreadNotifications();
    const interval = window.setInterval(loadUnreadNotifications, 15000);
    const refresh = () => loadUnreadNotifications();
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('tokenChanged', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('tokenChanged', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [loadUnreadNotifications]);

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
        <Link to={isGuest ? "/app/events" : "/app/dashboard"} className="app-navbar__logo">
          <span className="app-navbar__logo-m">M</span>
          <span className="app-navbar__logo-accent">Y</span>
          <span className="app-navbar__logo-m">M</span>
        </Link>

        {!isGuest && <div className="app-navbar__search">
          <GlobalSearch />
        </div>}

        <div className="app-navbar__center">
          {!isGuest && <NavLink to="/app/quick-match" className={navLinkClass}>
            {t('nav.quickMatch').toUpperCase()}
          </NavLink>}
          {!isGuest && <NavLink to="/app/deep-match" className={navLinkClass}>
            {t('nav.deepMatch').toUpperCase()}
          </NavLink>}
          <NavLink to="/app/events" className={navLinkClass}>
            {t('nav.events').toUpperCase()}
          </NavLink>
          {!isGuest && <NavLink to="/app/chat" className={navLinkClass}>
            {t('nav.chat').toUpperCase()}
          </NavLink>}
        </div>

        <div className="app-navbar__right">
          <ThemeMenu variant="app" />

          {!isGuest && <Link to="/app/events/create" className="app-navbar__create">
            + {t('nav.createEvent').toUpperCase()}
          </Link>}

          {!isGuest && <NotificationsDropdown unread={notificationUnread} onUnreadChange={setNotificationUnread}
            onRefreshUnread={loadUnreadNotifications} />}

          {!isGuest && <div className="app-navbar__profile-wrap" ref={dropdownRef}>
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
          </div>}

          {isGuest && (
            <button type="button" className="app-navbar__drawer-logout app-navbar__guest-exit" onClick={handleLogout}>
              {t('guest.exit')}
            </button>
          )}

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
        {!isGuest && <div className="app-navbar__drawer-search">
          <GlobalSearch onNavigate={() => setMenuOpen(false)} />
        </div>}

        {!isGuest && <NotificationsDropdown mobile unread={notificationUnread} onUnreadChange={setNotificationUnread}
          onRefreshUnread={loadUnreadNotifications} onNavigate={() => setMenuOpen(false)} />}

        {!isGuest && <NavLink
          to="/app/quick-match"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.quickMatch').toUpperCase()}
        </NavLink>}
        {!isGuest && <NavLink
          to="/app/deep-match"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.deepMatch').toUpperCase()}
        </NavLink>}
        <NavLink
          to="/app/events"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.events').toUpperCase()}
        </NavLink>
        {!isGuest && <NavLink
          to="/app/chat"
          className={navLinkClass}
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.chat').toUpperCase()}
        </NavLink>}
        {!isGuest && <Link
          to="/app/events/create"
          className="app-navbar__drawer-create"
          onClick={() => setMenuOpen(false)}
        >
          + {t('nav.createEvent').toUpperCase()}
        </Link>}
        {!isGuest && <Link
          to="/app/profile"
          className="app-navbar__drawer-link"
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.myProfile')}
        </Link>}
        {!isGuest && <Link
          to="/app/settings"
          className="app-navbar__drawer-link"
          onClick={() => setMenuOpen(false)}
        >
          {t('nav.settings')}
        </Link>}
        <ThemeMenu variant="app" layout="drawer" />
        <button
          type="button"
          className="app-navbar__drawer-logout"
          onClick={handleLogout}
        >
          {isGuest ? t('guest.exit') : t('nav.logout')}
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
