"use client";

import { useEffect, type ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "@/lib/i18n";

interface I18nProviderProps {
  children: ReactNode;
}

/**
 * Wraps the application with the i18next context.
 * Must be a Client Component because react-i18next uses React Context.
 *
 * Place this inside ThemeProvider (or alongside it) in app/layout.tsx.
 */
export default function I18nProvider({ children }: I18nProviderProps) {
  // Ensure i18n is ready before rendering children
  useEffect(() => {
    // The i18n instance is already initialized in lib/i18n.ts.
    // This effect is a no-op but keeps the door open for future
    // async loading (e.g., lazy-loaded namespaces).
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
