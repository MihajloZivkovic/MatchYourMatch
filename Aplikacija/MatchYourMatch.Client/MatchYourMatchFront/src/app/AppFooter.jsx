import './AppFooter.css';

const LINKS = ['Privacy', 'Community', 'Terms', 'Support'];

function AppFooter() {
  return (
    <footer className="app-footer">
      <p className="app-footer__copy">© 2026 MYM — Built for meaningful connections</p>
      <nav className="app-footer__nav" aria-label="App footer">
        {LINKS.map((label) => (
          <button key={label} type="button" className="app-footer__link app-interactive">
            {label}
          </button>
        ))}
      </nav>
    </footer>
  );
}

export default AppFooter;
