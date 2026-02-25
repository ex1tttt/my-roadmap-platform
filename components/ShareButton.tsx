"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useHasMounted } from '@/hooks/useHasMounted';

interface ShareButtonProps {
  cardId: string | undefined;
  title?: string;
  description?: string;
  label?: string;
  /** дополнительные классы для обёртки кнопки */
  className?: string;
}

export default function ShareButton({ cardId, title = "Roadmap", description, label, className = "" }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const mounted = useHasMounted();

  async function handleShare(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!cardId) {
      console.error('ShareButton: cardId is missing, cannot build share URL');
      return;
    }

    const url = `${window.location.origin}/card/${cardId}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: description ?? title,
          url,
        });
      } catch {
        // пользователь отменил — ничего не делаем
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback: выделяем через prompt
        prompt(t('share.copyLink'), url);
      }
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={!cardId}
      title={cardId ? (mounted ? t('share.label') : 'Share') : 'Card ID missing'}
      className={`relative flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <Share2 className="h-3.5 w-3.5" />
      {label && <span>{copied ? (mounted ? t('share.copied') : 'Copied!') : label}</span>}
      {!label && copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200 shadow">
          {mounted ? t('share.linkCopied') : 'Link copied!'}
        </span>
      )}
    </button>
  );
}
