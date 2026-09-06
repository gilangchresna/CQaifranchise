import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Language, translations, TranslationKeys } from "./index";

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationKeys;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = "cq_language";

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get from localStorage first
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "id") {
        return stored;
      }
    }
    return "en";
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, lang);
    }
  };

  useEffect(() => {
    // Update HTML lang attribute
    document.documentElement.lang = language;
  }, [language]);

  const t = translations[language];

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return context;
}
