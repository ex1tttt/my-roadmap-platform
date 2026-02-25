"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Globe, Check, ChevronDown } from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  saveLanguage,
  type SupportedLanguage,
} from "@/lib/i18n";

interface LanguageSwitcherProps {
  /** When true, only the globe icon is shown (compact mode for Navbar). */
  compact?: boolean;
}

export default function LanguageSwitcher({ compact = false }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentLang = (i18n.language?.split("-")[0] ?? "en") as SupportedLanguage;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function switchLanguage(lang: SupportedLanguage) {
    i18n.changeLanguage(lang);
    saveLanguage(lang);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={t("language.label")}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm
                   text-slate-600 dark:text-slate-400
                   hover:bg-slate-100 dark:hover:bg-white/10
                   hover:text-slate-900 dark:hover:text-white
                   transition-colors"
      >
        <Globe className="h-4 w-4 shrink-0" />
        {!compact && (
          <>
            <span className="font-medium uppercase tracking-wide">
              {currentLang}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            />
          </>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          role="listbox"
          aria-label={t("language.label")}
          className="absolute right-0 z-50 mt-1 min-w-40 rounded-xl
                     border border-slate-200 dark:border-white/10
                     bg-white dark:bg-slate-900
                     shadow-lg shadow-black/10 dark:shadow-black/40
                     py-1 overflow-hidden"
        >
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isActive = lang === currentLang;
            return (
              <button
                key={lang}
                role="option"
                aria-selected={isActive}
                onClick={() => switchLanguage(lang)}
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-sm
                            transition-colors
                            ${
                              isActive
                                ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30"
                                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                            }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs uppercase text-slate-400 dark:text-slate-500 w-6">
                    {lang}
                  </span>
                  <span>{LANGUAGE_LABELS[lang]}</span>
                </div>
                {isActive && <Check className="h-3.5 w-3.5 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
