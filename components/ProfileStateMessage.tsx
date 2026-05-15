"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import { useTranslation } from "react-i18next";

function ProfileMessageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-zinc-950">
      <div className="text-center">{children}</div>
    </div>
  );
}

export function ProfileNotFound() {
  const { t } = useTranslation();
  return (
    <ProfileMessageShell>
      <p className="text-lg text-slate-500 dark:text-slate-400">{t("profile.notFound")}</p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:underline"
      >
        <Home className="h-3.5 w-3.5" />
        {t("nav.backToHome")}
      </Link>
    </ProfileMessageShell>
  );
}

export function ProfileBlocked() {
  const { t } = useTranslation();
  return (
    <ProfileMessageShell>
      <p className="text-lg text-slate-500 dark:text-slate-400">{t("block.blockedPage")}</p>
      <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">{t("block.blockedPageDesc")}</p>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-1.5 text-sm text-blue-400 hover:underline"
      >
        <Home className="h-3.5 w-3.5" />
        {t("nav.backToHome")}
      </Link>
    </ProfileMessageShell>
  );
}
