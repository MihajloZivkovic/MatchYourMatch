import { useCallback, useEffect, useMemo, useState } from 'react';
import { supportedLanguages, translations } from '../i18n/translations';
import { I18nContext } from './i18nContextValue';

function getInitialLanguage() {
  const saved = localStorage.getItem('language');
  if (supportedLanguages.includes(saved)) return saved;
  return navigator.language?.toLowerCase().startsWith('sr') ? 'sr' : 'en';
}

function resolveValue(source, key) {
  return key.split('.').reduce((value, part) => value?.[part], source);
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(getInitialLanguage);

  const setLanguage = useCallback((nextLanguage) => {
    if (!supportedLanguages.includes(nextLanguage)) return;
    localStorage.setItem('language', nextLanguage);
    setLanguageState(nextLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const t = useCallback((key, variables = {}) => {
    const translated = resolveValue(translations[language], key);
    const fallback = resolveValue(translations.en, key);
    const value = typeof translated === 'string' ? translated : typeof fallback === 'string' ? fallback : key;
    return Object.entries(variables).reduce(
      (text, [name, replacement]) => text.replaceAll(`{{${name}}}`, String(replacement)),
      value,
    );
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
