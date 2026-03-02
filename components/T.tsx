"use client";

import { useTranslation } from "react-i18next";

/** Minimal client-side translation wrapper for use inside server components */
export default function T({ k }: { k: string }) {
  const { t } = useTranslation();
  return <>{t(k)}</>;
}
