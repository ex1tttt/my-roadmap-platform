"use client";

import Link from 'next/link';
import { Pencil } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CardEditButtonProps {
  cardId: string;
  cardType?: "list" | "gantt";
}

export default function CardEditButton({ cardId, cardType = "list" }: CardEditButtonProps) {
  const { t } = useTranslation();
  const editHref = cardType === "gantt" ? `/card/${cardId}/edit-gantt` : `/card/${cardId}/edit`;
  return (
    <Link
      href={editHref}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 transition-colors hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-blue-500 dark:hover:text-blue-400"
    >
      <Pencil className="h-3.5 w-3.5" />
      <span suppressHydrationWarning>{t('card.editCard')}</span>
    </Link>
  );
}
