"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ isOwner }: { isOwner: boolean }) {
  const router = useRouter();

  function handleBack() {
    // Если в истории браузера есть предыдущая страница — идём назад
    if (window.history.length > 1) {
      router.back();
    } else if (isOwner) {
      // Открыли ссылку напрямую и это своя карточка — в профиль
      router.push("/profile");
    } else {
      // Открыли ссылку напрямую — на главную
      router.push("/");
    }
  }

  return (
    <button
      onClick={handleBack}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition-colors hover:text-slate-900 dark:hover:text-slate-200"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Назад
    </button>
  );
}
