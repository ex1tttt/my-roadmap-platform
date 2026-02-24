"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";

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
        console.log('Sharing URL:', url);
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
        prompt("Скопируйте ссылку:", url);
      }
    }
  }

  return (
    <button
      onClick={handleShare}
      disabled={!cardId}
      title={cardId ? 'Поделиться' : 'ID карточки недоступен'}
      className={`relative flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-blue-400 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      <Share2 className="h-3.5 w-3.5" />
      {label && <span>{copied ? 'Скопировано!' : label}</span>}
      {!label && copied && (
        <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-700 px-2 py-0.5 text-[10px] text-slate-200 shadow">
          Ссылка скопирована!
        </span>
      )}
    </button>
  );
}
