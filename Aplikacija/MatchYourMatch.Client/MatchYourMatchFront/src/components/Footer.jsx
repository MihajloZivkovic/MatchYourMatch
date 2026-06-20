const footerLinks = [
  { label: 'Marko', href: '#' },
  { label: 'Mihajlo', href: '#' },
  { label: 'Aleksandar', href: '#' },
  { label: 'Jana', href: '#' },
];

import { useTranslation } from '../hooks/useTranslation';

const legalLinks = [
  { key: 'privacyPolicy', href: '#' },
  { key: 'termsService', href: '#' },
  { key: 'cookies', href: '#' },
];

function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="footer">
      <div className="footer__main">
        <p className="footer__logo" aria-label="Match Your Match">
          <span>MATCH</span>
          <span className="footer__logo-accent">YOUR</span>
          <span>MATCH</span>
        </p>

        <nav className="footer__nav" aria-label={t('footer.navigation')}>
          <ul className="footer__links">
            {footerLinks.map(({ label, href }) => (
              <li key={label}>
                <a href={href}>{label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="footer__divider" aria-hidden="true" />

      <div className="footer__bottom">
        <p className="footer__copyright">
          &copy; {new Date().getFullYear()} MYM TEAM. {t('footer.rights')}
        </p>
        <nav className="footer__legal" aria-label={t('footer.legal')}>
          <ul>
            {legalLinks.map(({ key, href }) => (
              <li key={key}>
                <a href={href}>{t(`footer.${key}`)}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

export default Footer;
