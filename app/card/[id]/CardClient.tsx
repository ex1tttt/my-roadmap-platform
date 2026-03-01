"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { ExternalLink, ArrowLeft, BookOpen, Pencil, Loader2, ShieldAlert } from "lucide-react";

// Импорты компонентов
import UserAvatar from "@/components/UserAvatar";
import DeleteButton from "@/components/DeleteButton";
import CommentSection from "@/components/CommentSection";
import StarRating from "@/components/StarRating";
import ScrollToHash from "@/components/ScrollToHash";
import ShareButton from "@/components/ShareButton";
import StepsProgress from "@/components/StepsProgress";
import ClientOnly from "@/components/ClientOnly";

// --- Вспомогательные функции из твоего старого кода ---
function normalizeUrl(url: string): string {
  if (!url) return url;
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

export default function CardClient({ id }: { id: string }) {
  const [card, setCard] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [initialDone, setInitialDone] = useState<string[]>([]);

  useEffect(() => {
    if (!id || id === "undefined") return;

    async function fetchData() {
      setLoading(true);

      // 1. Юзер + карточка параллельно
      // getSession читает из кукисов без сетевого запроса — не падает при протухшем refresh token
      const [{ data: { session } }, { data: cardData }] = await Promise.all([
        supabase.auth.getSession(),
        supabase
          .from("cards")
          .select("*, steps(*), resources(*), profiles:user_id(*)")
          .eq("id", id)
          .maybeSingle(),
      ]);

      const user = session?.user ?? null;
      console.log('[CardClient] user =>', user ? `uid=${user.id}` : 'null (не авторизован)');
      setCurrentUser(user);

      if (cardData) {
        setCard(cardData);

        if (user) {
          // Прогресс
          const { data: prog } = await supabase
            .from('user_progress')
            .select('step_id')
            .eq('user_id', user.id)
            .eq('card_id', id);
          setInitialDone(prog?.map((p: any) => p.step_id) || []);

          // Запись в историю просмотров
          console.log('[view_history] upsert → user_id:', user.id, '| card_id:', id);
          const { data: upsertData, error: histErr } = await supabase
            .from('view_history')
            .upsert(
              { user_id: user.id, card_id: id, viewed_at: new Date().toISOString() },
              { onConflict: 'user_id,card_id' }
            )
            .select();
          console.log('History status:', histErr ? `ERROR: ${histErr.code} ${histErr.message}` : 'OK', '| data:', upsertData);
        }
      }
      setLoading(false);
    }
    fetchData();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617]">
      <Loader2 className="animate-spin text-blue-500" size={40} />
    </div>
  );

  if (!card) return (
    <div className="min-h-screen flex items-center justify-center bg-[#020617] text-white">
      <div className="text-center p-10 border border-white/10 rounded-2xl bg-white/5">
        <ShieldAlert className="mx-auto mb-4 text-red-500" size={48} />
        <h2 className="text-xl font-bold">Карточка не найдена</h2>
        <Link href="/" className="text-blue-400 mt-4 block">На главную</Link>
      </div>
    </div>
  );

  // Обработка данных автора
  const author = Array.isArray(card.profiles) ? (card.profiles[0] ?? null) : (card.profiles ?? null);
  const authorName = author?.username ?? 'Автор неизвестен';
  const authorAvatar = author?.avatar ?? null;
  const steps = (card.steps || []).sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  const resources = (card.resources || []).filter((r: any) => r.url);
  const isOwner = currentUser?.id === card.user_id;

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] text-slate-900 dark:text-slate-100 pb-20">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <div className="flex justify-between items-center mb-8">
          <Link href="/" className="flex items-center gap-2 text-sm text-slate-500"><ArrowLeft size={16}/> Назад</Link>
          <div className="flex gap-2">
            <ShareButton cardId={id} title={card.title} />
            {isOwner && <Link href={`/card/${id}/edit`} className="p-2 border border-white/10 rounded-lg"><Pencil size={16}/></Link>}
          </div>
        </div>

        <h1 className="text-4xl font-extrabold mb-10">{card.title}</h1>

        <div className="grid lg:grid-cols-[1fr_300px] gap-12">
          <section>
            <StepsProgress cardId={id} userId={currentUser?.id} steps={steps} initialDone={initialDone} />
          </section>
          <aside className="space-y-8">
            <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-4">Оценить</h3>
              <StarRating roadmapId={id} />
            </div>
            {card.resources && card.resources.length > 0 && (
              <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-5">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  <ExternalLink className="h-4 w-4" />
                  Материалы
                </h2>
                <ul className="space-y-2">
                  {card.resources.map((r: any) => (
                    <li key={r.id}>
                      <a
                        href={normalizeUrl(r.url!)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/0 px-3 py-2.5 text-sm text-slate-600 dark:text-slate-300 transition-all hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-500 dark:hover:text-blue-300"
                      >
                        <span className="truncate">{r.label || r.url}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-4">
          <Link href={`/profile/${card.user_id}`} className="group flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-500 transition-colors">
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <UserAvatar username={authorName} size={20} />
            )}
            <span className="font-medium">{authorName}</span>
          </Link>
          <StarRating roadmapId={id} compact />
        </div>

        {card.description && (
          <p className="mt-2 line-clamp-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
            {card.description}
          </p>
        )}
      </div>
      <ScrollToHash />
    </div>
  );
}