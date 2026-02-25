"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Trash2 } from "lucide-react";
import { useTranslation } from 'react-i18next';

export default function DeleteButton({ cardId }: { cardId: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    if (!window.confirm(t('delete.confirm'))) return;

    setDeleting(true);
    try {
      const { error } = await supabase.from("cards").delete().eq("id", cardId);
      if (error) throw error;
      router.push("/");
      router.refresh();
    } catch (err: any) {
      console.error("Delete error:", err);
      alert(t('delete.error') + ': ' + (err?.message ?? t('common.error')));
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="mt-1 inline-flex shrink-0 items-center gap-2 rounded-lg border border-red-900/50 bg-transparent px-3 py-2 text-sm text-red-500 transition-all hover:border-red-600/70 hover:bg-red-600/5 hover:text-red-400 hover:shadow-[0_0_12px_rgba(220,38,38,0.15)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {deleting ? (
        <>
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          {t('delete.deleting')}
        </>
      ) : (
        <>
          <Trash2 className="h-4 w-4" />
          {t('delete.label')}
        </>
      )}
    </button>
  );
}
