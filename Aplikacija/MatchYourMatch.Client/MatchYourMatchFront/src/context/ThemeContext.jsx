import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export const THEME_STORAGE_KEY = 'mym-theme';

const ThemeContext = createContext(null);

function getSystemTheme() {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches
    ? 'light'
    : 'dark';
}

export function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return getSystemTheme();
}

function applyThemeToDocument(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.documentElement.style.colorScheme = theme;
}

function enableThemeTransition() {
  document.documentElement.classList.add('theme-transition');
  window.setTimeout(() => {
    document.documentElement.classList.remove('theme-transition');
  }, 400);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    applyThemeToDocument(theme);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');

    const handleChange = () => {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (!stored) {
        setThemeState(media.matches ? 'light' : 'dark');
      }
    };

    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const setTheme = useCallback((nextTheme) => {
    setThemeState((current) => {
      if (current === nextTheme) return current;
      enableThemeTransition();
      return nextTheme;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      enableThemeTransition();
      return current === 'dark' ? 'light' : 'dark';
    });
  }, []);

  const value = useMemo(
    () => ({
      theme,
      isDark: theme === 'dark',
      isLight: theme === 'light',
      setTheme,
      toggleTheme,
    }),
    [theme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
