import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import en from "@/i18n/en.json";
import te from "@/i18n/te.json";
import hi from "@/i18n/hi.json";

export type Locale = "en" | "te" | "hi";

const messages: Record<Locale, Record<string, any>> = { en, te, hi };

export const localeNames: Record<Locale, string> = {
  en: "English",
  te: "తెలుగు",
  hi: "हिंदी",
};

// Map locale to language name for AI prompts
export const localeToLanguage: Record<Locale, string> = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  language: string; // Full language name for AI
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

function getNestedValue(obj: any, path: string): string {
  return path.split(".").reduce((acc, part) => acc?.[part], obj) ?? path;
}

function getInitialLocale(): Locale {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("vw-locale");
    if (stored === "en" || stored === "te" || stored === "hi") return stored;
    // Check cookie
    const match = document.cookie.match(/vw-locale=(en|te|hi)/);
    if (match) return match[1] as Locale;
  }
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getInitialLocale);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("vw-locale", l);
    document.cookie = `vw-locale=${l};path=/;max-age=31536000`;
    document.documentElement.lang = l;
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback((key: string): string => {
    return getNestedValue(messages[locale], key);
  }, [locale]);

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, language: localeToLanguage[locale] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Fallback for edge cases (HMR, render outside provider)
    const fallbackT = (key: string): string => getNestedValue(messages["en"], key);
    return { locale: "en" as Locale, setLocale: () => {}, t: fallbackT, language: "English" };
  }
  return ctx;
}
