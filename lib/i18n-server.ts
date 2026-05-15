import { cookies } from "next/headers";
import en from "@/locales/en.json";
import ru from "@/locales/ru.json";
import uk from "@/locales/uk.json";
import pl from "@/locales/pl.json";

export const SUPPORTED_LANGUAGES = ["en", "uk", "pl", "ru"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

const STORAGE_KEY = "app-language";

const RESOURCES: Record<SupportedLanguage, Record<string, unknown>> = {
  en: en as Record<string, unknown>,
  ru: ru as Record<string, unknown>,
  uk: uk as Record<string, unknown>,
  pl: pl as Record<string, unknown>,
};

function resolve(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>
): string {
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) =>
    vars[key] != null ? String(vars[key]) : `{{${key}}}`
  );
}

export async function getServerLocale(): Promise<SupportedLanguage> {
  const cookieStore = await cookies();
  const stored = cookieStore.get(STORAGE_KEY)?.value as SupportedLanguage | undefined;
  if (stored && SUPPORTED_LANGUAGES.includes(stored)) return stored;
  return "en";
}

export async function getServerT() {
  const locale = await getServerLocale();
  const dict = RESOURCES[locale];
  const fallback = RESOURCES.en;

  return function t(
    key: string,
    vars?: Record<string, string | number>
  ): string {
    const raw = resolve(dict, key) ?? resolve(fallback, key) ?? key;
    return interpolate(raw, vars);
  };
}
