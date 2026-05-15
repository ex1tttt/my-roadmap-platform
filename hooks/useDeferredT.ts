"use client";

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useHasMounted } from "@/hooks/useHasMounted";

/**
 * Переводы для SSR и первого клиентского кадра совпадают с английским (как в lib/i18n),
 * после монтирования — активная локаль из cookie/localStorage. Убирает hydration mismatch.
 */
export function useDeferredT() {
  const { t, i18n } = useTranslation();
  const mounted = useHasMounted();

  return useCallback(
    (key: string, options?: Record<string, string | number>) => {
      if (mounted) return t(key, options);
      return String(i18n.t(key, { ...(options ?? {}), lng: "en" }));
    },
    [mounted, t, i18n]
  );
}
