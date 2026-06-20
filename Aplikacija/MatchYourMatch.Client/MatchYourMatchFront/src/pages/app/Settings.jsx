import { Check, Languages, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import './Settings.css';

const THEME_OPTIONS = [
  { value: 'system', icon: Monitor },
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', labelKey: 'language.english', code: 'EN' },
  { value: 'sr', labelKey: 'language.serbian', code: 'SR' },
];

function Settings() {
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useTranslation();

  return (
    <div className="page-fade-in settings-page">
      <header className="settings-page__header">
        <span className="settings-page__eyebrow">MYM</span>
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.subtitle')}</p>
      </header>

      <div className="settings-page__grid">
        <section className="settings-card">
          <div className="settings-card__heading">
            <span className="settings-card__icon"><Palette size={20} /></span>
            <div>
              <h2>{t('settings.appearance')}</h2>
              <p>{t('settings.appearanceText')}</p>
            </div>
          </div>
          <div className="settings-options settings-options--three">
            {THEME_OPTIONS.map(({ value, icon: Icon }) => {
              const selected = theme === value;
              return (
                <button key={value} type="button" className={`settings-option${selected ? ' settings-option--selected' : ''}`} onClick={() => setTheme(value)} aria-pressed={selected}>
                  <Icon size={21} />
                  <span>{t(`theme.${value}`)}</span>
                  {selected && <Check className="settings-option__check" size={16} aria-label={t('settings.selected')} />}
                </button>
              );
            })}
          </div>
        </section>

        <section className="settings-card">
          <div className="settings-card__heading">
            <span className="settings-card__icon"><Languages size={20} /></span>
            <div>
              <h2>{t('settings.language')}</h2>
              <p>{t('settings.languageText')}</p>
            </div>
          </div>
          <div className="settings-options">
            {LANGUAGE_OPTIONS.map(({ value, labelKey, code }) => {
              const selected = language === value;
              return (
                <button key={value} type="button" className={`settings-option${selected ? ' settings-option--selected' : ''}`} onClick={() => setLanguage(value)} aria-pressed={selected}>
                  <strong>{code}</strong>
                  <span>{t(labelKey)}</span>
                  {selected && <Check className="settings-option__check" size={16} aria-label={t('settings.selected')} />}
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default Settings;
