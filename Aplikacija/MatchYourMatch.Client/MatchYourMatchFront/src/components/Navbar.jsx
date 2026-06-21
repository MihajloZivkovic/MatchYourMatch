import { Link } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import LanguageSwitcher from './LanguageSwitcher';
import ThemeMenu from './ThemeMenu';

function Navbar({ isExiting = false, onAboutClick }) {
  const { t } = useTranslation();

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
          <ThemeMenu variant="public" />
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
