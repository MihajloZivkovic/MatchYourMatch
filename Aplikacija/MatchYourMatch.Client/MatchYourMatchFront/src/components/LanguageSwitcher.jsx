import { useEffect, useRef, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import './LanguageSwitcher.css';

function LanguageSwitcher({ compact = false }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const { language, setLanguage, t } = useTranslation();

  useEffect(() => {
    const close = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = (next) => {
    setLanguage(next);
    setOpen(false);
  };

  return (
    <div
      className={`language-switcher${compact ? ' language-switcher--compact' : ''}`}
      ref={rootRef}
    >
      <button
        type='button'
        className='language-switcher__button'
        aria-label={`${t('language.label')}: ${language.toUpperCase()}`}
        aria-expanded={open}
        aria-haspopup='menu'
        onClick={() => setOpen((value) => !value)}
      >
        <Globe2 size={16} aria-hidden='true' />
      </button>
      {open && (
        <div
          className='language-switcher__menu'
          role='menu'
          aria-label={t('language.choose')}
        >
          <button
            type='button'
            role='menuitemradio'
            aria-checked={language === 'en'}
            className={language === 'en' ? 'language-switcher__active' : ''}
            onClick={() => select('en')}
          >
            EN <span>{t('language.english')}</span>
          </button>
          <button
            type='button'
            role='menuitemradio'
            aria-checked={language === 'sr'}
            className={language === 'sr' ? 'language-switcher__active' : ''}
            onClick={() => select('sr')}
          >
            SR <span>{t('language.serbian')}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
