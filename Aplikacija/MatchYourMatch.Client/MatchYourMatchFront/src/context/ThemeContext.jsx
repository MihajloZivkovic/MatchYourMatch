import { createContext, useContext, useEffect, useMemo, useState } from "react";

const ThemeContext = createContext(null);
export const THEME_STORAGE_KEY = "theme";
const THEME_OPTIONS = ["system", "light", "dark"];

function getStoredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return THEME_OPTIONS.includes(stored) ? stored : "system";
}

function getSystemTheme() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getInitialResolvedTheme() {
  const stored = getStoredTheme();
  return stored === "system" ? getSystemTheme() : stored;
}

function applyTheme(resolvedTheme, choice) {
  document.documentElement.setAttribute("data-theme", resolvedTheme);
  document.documentElement.setAttribute("data-theme-choice", choice);
  document.documentElement.style.colorScheme = resolvedTheme;
}

function enableThemeTransition() {
  document.documentElement.classList.add("theme-transition");
  window.setTimeout(() => {
    document.documentElement.classList.remove("theme-transition");
  }, 400);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);
  const [systemTheme, setSystemTheme] = useState(getSystemTheme);

  const resolvedTheme = theme === "system" ? systemTheme : theme;

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;

    const handleChange = (event) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };

    setSystemTheme(mediaQuery.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    applyTheme(resolvedTheme, theme);
  }, [resolvedTheme, theme]);

  const setTheme = (nextTheme) => {
    if (!THEME_OPTIONS.includes(nextTheme)) return;

    setThemeState((current) => {
      if (current === nextTheme) return current;
      enableThemeTransition();
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  };

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  const value = useMemo(
    () => ({
      theme,
      resolvedTheme,
      isDark: resolvedTheme === "dark",
      isLight: resolvedTheme === "light",
      setTheme,
      toggleTheme,
    }),
    [resolvedTheme, theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider.");
  }

  return context;
}
