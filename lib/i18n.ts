import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "@/locales/en.json";
import uk from "@/locales/uk.json";
import pl from "@/locales/pl.json";
import ru from "@/locales/ru.json";

// Supported locales
export const SUPPORTED_LANGUAGES = ["en", "uk", "pl", "ru"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  en: "English",
  uk: "Українська",
  pl: "Polski",
  ru: "Русский",
};

const STORAGE_KEY = "app-language";

/**
 * Detect the best language to use:
 * 1. User's manual preference saved in localStorage
 * 2. Browser navigator.language (first match from supported list)
 * 3. Fallback: "en"
 */
function detectLanguage(): SupportedLanguage {
  if (typeof window === "undefined") return "en";

  // 1. Manual preference
  const stored = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;

  // 2. Browser languages (navigator.languages or navigator.language)
  const browserLanguages =
    navigator.languages?.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const lang of browserLanguages) {
    // Try exact match first (e.g. "uk"), then prefix (e.g. "uk-UA" → "uk")
    const exact = lang as SupportedLanguage;
    if (SUPPORTED_LANGUAGES.includes(exact)) return exact;

    const prefix = lang.split("-")[0] as SupportedLanguage;
    if (SUPPORTED_LANGUAGES.includes(prefix)) return prefix;
  }

  return "en";
}

/**
 * Persist the user's language choice to localStorage.
 * Call this after a manual switch.
 */
export function saveLanguage(lang: SupportedLanguage): void {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, lang);
  }
}

// Avoid re-initializing on hot-module reload
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      uk: { translation: uk },
      pl: { translation: pl },
      ru: { translation: ru },
    },
    lng: detectLanguage(),
    fallbackLng: "en",
    // Force synchronous initialization so translations are ready
    // before the first React render (critical when using inline resources)
    initImmediate: false,
    interpolation: {
      // React already escapes values
      escapeValue: false,
    },
    // Return key itself if translation is missing (helpful during development)
    parseMissingKeyHandler: (key) => `[${key}]`,
  });
}

export default i18n;
