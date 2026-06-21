import './AppFooter.css';
import { useTranslation } from '../hooks/useTranslation';

const LINKS = ['privacy', 'community', 'terms', 'support'];

function AppFooter() {
  const { t } = useTranslation();

  return (
    <footer className="app-footer">
      <p className="app-footer__copy">{t('footer.built')}</p>
      <nav className="app-footer__nav" aria-label={t('footer.navigation')}>
        {LINKS.map((label) => (
          <button key={label} type="button" className="app-footer__link app-interactive">
            {t(`footer.${label}`)}
          </button>
        ))}
      </nav>
    </footer>
  );
}

export default AppFooter;
