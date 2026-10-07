import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { isLanguage, LANGUAGES, translations, type Language, type Messages } from './translations';
import { clearLanguagePreference, pruneLanguagePreference, readLanguagePreference, saveChosenLanguage } from './languageStorage';

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; locale: string; t: Messages; hasSavedLanguage: boolean; forgetLanguage: () => boolean };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function loadSavedLanguage(storage?: Pick<Storage, 'getItem'>): Language {
  return readLanguagePreference(storage)?.language ?? 'es';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(loadSavedLanguage);
  const [hasSavedLanguage, setHasSavedLanguage] = useState(() => readLanguagePreference() !== null);
  const setLanguage = (value: Language) => {
    if (!isLanguage(value)) return;
    updateLanguage(value);
    // Persist exclusively in response to an explicit language selection.
    setHasSavedLanguage(saveChosenLanguage(value));
  };
  const forgetLanguage = () => {
    const removed = clearLanguagePreference();
    if (removed) setHasSavedLanguage(false);
    return removed;
  };
  const t = translations[language];
  const locale = LANGUAGES.find(item => item.code === language)!.locale;
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = t.appTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.appDescription);
  }, [language, locale, t]);
  useEffect(() => { pruneLanguagePreference(); }, []);
  return <LanguageContext.Provider value={{ language, setLanguage, locale, t, hasSavedLanguage, forgetLanguage }}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
