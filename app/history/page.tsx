"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Card from "@/components/Card";
import { Clock, ArrowLeft, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHasMounted } from "@/hooks/useHasMounted";

type Step = { id: string; order: number; title: string; content?: string; media_url?: string };
type Profile = { id: string; username: string; avatar?: string };
type CardType = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  user: Profile;
  steps?: Step[];
  likesCount: number;
  isLiked: boolean;
  isFavorite: boolean;
  viewedAt: string;
};

export default function HistoryPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadHistory() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Шаг 1: получаем историю просмотров
      const { data: historyData, error: histError } = await supabase
        .from("view_history")
        .select("card_id, viewed_at")
        .eq("user_id", user.id)
        .order("viewed_at", { ascending: false });

      if (histError) {
        console.error('[history] view_history error:', histError.message);
        setLoading(false);
        return;
      }

      if (!historyData || historyData.length === 0) {
        setLoading(false);
        return;
      }

      const cardIds = historyData.map((h: any) => h.card_id);
      const viewedAtMap = new Map<string, string>(historyData.map((h: any) => [h.card_id, h.viewed_at]));

      // Шаг 2: параллельно тянем карточки + лайки + избранное
      const [cardsRes, likesRes, userLikesRes, favRes] = await Promise.all([
        supabase.from("cards").select("*, steps(*), profiles:user_id(*)").in("id", cardIds),
        supabase.from("likes").select("card_id").in("card_id", cardIds),
        supabase.from("likes").select("card_id").eq("user_id", user.id).in("card_id", cardIds),
        supabase.from("favorites").select("roadmap_id").eq("user_id", user.id).in("roadmap_id", cardIds),
      ]);

      if (cardsRes.error) {
        console.error('[history] cards error:', cardsRes.error.message);
        setLoading(false);
        return;
      }

      const authorIds = Array.from(new Set((cardsRes.data || []).map((r: any) => r.user_id)));
      const profilesRes = await supabase.from("profiles").select("*").in("id", authorIds);

      const profilesMap = new Map<string, Profile>();
      (profilesRes.data || []).forEach((p: any) =>
        profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar })
      );

      const likesCountMap = new Map<string, number>();
      (likesRes.data || []).forEach((l: any) => {
        likesCountMap.set(l.card_id, (likesCountMap.get(l.card_id) || 0) + 1);
      });

      const userLikedSet = new Set<string>((userLikesRes.data || []).map((l: any) => l.card_id));
      const favSet = new Set<string>((favRes.data || []).map((f: any) => f.roadmap_id));

      // Сортируем карточки в том же порядке, что история
      const cardsMap = new Map((cardsRes.data || []).map((r: any) => [r.id, r]));
      const merged: CardType[] = cardIds
        .map((cid: string) => cardsMap.get(cid))
        .filter(Boolean)
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category,
          user: (() => {
            const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
            return p ? { id: p.id, username: p.username, avatar: p.avatar } : profilesMap.get(r.user_id) || { id: r.user_id, username: "Unknown" };
          })(),
          steps: ((r.steps || []) as Step[]).slice().sort((a: any, b: any) => a.order - b.order),
          likesCount: likesCountMap.get(r.id) || 0,
          isLiked: userLikedSet.has(r.id),
          isFavorite: favSet.has(r.id),
          viewedAt: viewedAtMap.get(r.id) || "",
        }));

      setCards(merged);
      setLoading(false);
    }

    loadHistory();
  }, [router]);

  async function handleClearHistory() {
    if (!userId) return;
    setClearing(true);
    await supabase.from("view_history").delete().eq("user_id", userId);
    setCards([]);
    setClearing(false);
  }

  // Форматирование даты просмотра
  function formatViewed(iso: string) {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return "только что";
    if (diffMin < 60) return `${diffMin} мин. назад`;
    if (diffHr < 24) return `${diffHr} ч. назад`;
    if (diffDay < 7) return `${diffDay} дн. назад`;
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  }

  if (!mounted) return <div className="opacity-0" />;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#020617]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-6">
      <main className="mx-auto max-w-6xl">
        {/* Заголовок */}
        <header className="mb-8 flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-5 w-5 text-blue-400" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                История просмотров
              </h1>
            </div>
            <p className="text-sm text-slate-400">
              {cards.length > 0
                ? `${cards.length} карточек в истории`
                : "Ваша история пуста"}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {cards.length > 0 && (
              <button
                onClick={handleClearHistory}
                disabled={clearing}
                className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 transition-colors hover:bg-red-500/20 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                {clearing ? "Очистка..." : "Очистить историю"}
              </button>
            )}
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("nav.backToHome")}
            </Link>
          </div>
        </header>

        {/* Пустое состояние */}
        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 px-6 py-20 text-center backdrop-blur-md">
            <Clock className="mb-4 h-12 w-12 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-700 dark:text-slate-200">
              История просмотров пуста
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Карточки, которые вы открывали, будут отображаться здесь.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              <ArrowLeft className="h-4 w-4" />
              {t("nav.backToHome")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {cards.map((c) => (
              <div key={c.id} className="flex flex-col gap-1">
                {/* Метка времени */}
                <p className="text-xs text-slate-500 flex items-center gap-1 px-1">
                  <Clock className="h-3 w-3" />
                  {formatViewed(c.viewedAt)}
                </p>
                <div className="cursor-pointer h-full" onClick={() => router.push(`/card/${c.id}`)}>
                  <Card
                    card={c}
                    userId={userId}
                    initialLikesCount={c.likesCount}
                    initialIsLiked={c.isLiked}
                    initialIsFavorite={c.isFavorite}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
