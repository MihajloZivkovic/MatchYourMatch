import ThemeMenu from './ThemeMenu';
import LanguageSwitcher from './LanguageSwitcher';
import { useRef, useState, useEffect } from 'react';
import { Settings } from 'lucide-react';

function ThemeLang({ variant = 'public', layout = 'dropdown' }) {
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const close = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target) && buttonRef.current && !buttonRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div className='language-switcher'>
      <button
        type='button'
        className='language-switcher__button adjust'
        aria-expanded={menuOpen}
        aria-haspopup='menu'
        ref={buttonRef}
        onClick={() => setMenuOpen((value) => !value)}
      >
        <Settings size={16} aria-hidden='true' />
      </button>
        {menuOpen && (
            <div
            className='language-switcher__menu language-switcher__menu--settings'
            role='menu'
            ref={menuRef}
            >
        
          <ThemeMenu variant={variant} layout={layout} />
          <LanguageSwitcher />
      </div>)}
    </div>
  );
}
export default ThemeLang;
