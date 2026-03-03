"use client";

import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n, { detectLanguage } from "@/lib/i18n";

interface I18nProviderProps {
  children: ReactNode;
}

/**
 * Wraps the application with the i18next context.
 * Switches to the user's stored locale AFTER hydration to avoid SSR mismatch.
 */
export default function I18nProvider({ children }: I18nProviderProps) {
  useEffect(() => {
    const lang = detectLanguage();
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang);
    }
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
