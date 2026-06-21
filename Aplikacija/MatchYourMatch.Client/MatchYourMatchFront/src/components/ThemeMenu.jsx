import { useEffect, useRef, useState } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';

const THEME_OPTIONS = [
  { value: 'system', Icon: Monitor },
  { value: 'light', Icon: Sun },
  { value: 'dark', Icon: Moon },
];

function ThemeMenu({ variant = 'public', layout = 'dropdown' }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { t } = useTranslation();

  const isApp = variant === 'app';
  const prefix = isApp ? 'app-navbar' : 'navbar';
  const ThemeIcon =
    theme === 'system' ? Monitor : resolvedTheme === 'light' ? Sun : Moon;

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectTheme(nextTheme) {
    setTheme(nextTheme);
    setMenuOpen(false);
  }

  if (layout === 'drawer') {
    return (
      <div className={`${prefix}__drawer-theme`}>
        <span>{t('theme.label')}</span>
        <div>
          {THEME_OPTIONS.map(({ value }) => (
            <button
              key={value}
              type="button"
              className={theme === value ? `${prefix}__drawer-theme-active` : ''}
              onClick={() => selectTheme(value)}
            >
              {t(`theme.${value}`)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`${prefix}__theme`} ref={menuRef}>
      <button
        type="button"
        className={`${prefix}__theme-btn`}
        aria-label={`${t('theme.label')}: ${theme}`}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <ThemeIcon size={17} aria-hidden="true" />
      </button>

      {menuOpen && (
        <div
          className={`${prefix}__theme-menu`}
          role="menu"
          aria-label={t('theme.choose')}
        >
          {THEME_OPTIONS.map(({ value, Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === value}
              className={theme === value ? `${prefix}__theme-option--active` : ''}
              onClick={() => selectTheme(value)}
            >
              <Icon size={15} aria-hidden="true" />
              {t(`theme.${value}`)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThemeMenu;
