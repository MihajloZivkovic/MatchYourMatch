import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';

function Navbar({ isExiting = false, onAboutClick }) {
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeRef = useRef(null);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();
  const ThemeIcon = theme === 'system' ? Monitor : resolvedTheme === 'light' ? Sun : Moon;

  useEffect(() => {
    function handleClickOutside(event) {
      if (themeRef.current && !themeRef.current.contains(event.target)) {
        setThemeMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectTheme(nextTheme) {
    setTheme(nextTheme);
    setThemeMenuOpen(false);
  }

  return (
    <header className={`navbar ${isExiting ? 'navbar--exiting' : ''}`}>
      <nav className="navbar__inner" aria-label={t('nav.main')}>
        <Link to="/" className="navbar__logo">
          <span className="navbar__logo-m">M</span>
          <span className="navbar__logo-accent">Y</span>
          <span className="navbar__logo-m">M</span>
        </Link>

        <div className="navbar__actions">
          <LanguageSwitcher />
          <div className="navbar__theme" ref={themeRef}>
            <button
              type="button"
              className="navbar__theme-btn"
              aria-label={`${t('theme.label')}: ${theme}`}
              aria-expanded={themeMenuOpen}
              aria-haspopup="menu"
              onClick={() => setThemeMenuOpen((open) => !open)}
            >
              <ThemeIcon size={17} aria-hidden="true" />
            </button>

            {themeMenuOpen && (
              <div className="navbar__theme-menu" role="menu" aria-label={t('theme.choose')}>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === 'system'}
                  className={theme === 'system' ? 'navbar__theme-option--active' : ''}
                  onClick={() => selectTheme('system')}
                >
                  <Monitor size={15} aria-hidden="true" />
                  {t('theme.system')}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === 'light'}
                  className={theme === 'light' ? 'navbar__theme-option--active' : ''}
                  onClick={() => selectTheme('light')}
                >
                  <Sun size={15} aria-hidden="true" />
                  {t('theme.light')}
                </button>
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={theme === 'dark'}
                  className={theme === 'dark' ? 'navbar__theme-option--active' : ''}
                  onClick={() => selectTheme('dark')}
                >
                  <Moon size={15} aria-hidden="true" />
                  {t('theme.dark')}
                </button>
              </div>
            )}
          </div>
          <a href="/about" className="navbar__link" onClick={onAboutClick}>
            {t('nav.about').toUpperCase()}
          </a>
          <Link to="/login" className="btn btn--outline navbar__btn">
            {t('nav.login').toUpperCase()}
          </Link>
          <Link to="/register" className="btn btn--outline navbar__btn">
            {t('nav.register').toUpperCase()}
          </Link>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
