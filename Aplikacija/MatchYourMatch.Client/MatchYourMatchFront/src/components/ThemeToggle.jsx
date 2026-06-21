import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import './ThemeToggle.css';

function ThemeToggle({ className = '', variant = 'default' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={`theme-toggle theme-toggle--${variant}${className ? ` ${className}` : ''}`}
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      <span className="theme-toggle__icon theme-toggle__icon--sun" aria-hidden="true">
        <Sun size={18} strokeWidth={2} />
      </span>
      <span className="theme-toggle__icon theme-toggle__icon--moon" aria-hidden="true">
        <Moon size={18} strokeWidth={2} />
      </span>
    </button>
  );
}

export default ThemeToggle;
