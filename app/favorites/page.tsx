"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Card from "@/components/Card";
import { Bookmark, ArrowLeft } from "lucide-react";

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
};

export default function FavoritesPage() {
  const router = useRouter();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    async function loadFavorites() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setUserId(user.id);

      // Один join-запрос: favorites + cards (roadmap) + steps + profiles
      const { data: favData, error: favError } = await supabase
        .from("favorites")
        .select("roadmap_id, roadmap:roadmap_id(*, steps(*))")
        .eq("user_id", user.id);

      if (favError) {
        console.error("Favorites fetch error:", favError);
        setLoading(false);
        return;
      }

      if (!favData || favData.length === 0) {
        setLoading(false);
        return;
      }

      const cardIds = favData.map((f: any) => f.roadmap_id).filter(Boolean);

      // Параллельно: лайки (count) + пользовательские лайки + профили авторов
      const rawRoadmaps = favData.map((f: any) => f.roadmap).filter(Boolean);
      const authorIds = Array.from(new Set(rawRoadmaps.map((r: any) => r.user_id)));

      const [likesRes, userLikesRes, profilesRes] = await Promise.all([
        supabase.from("likes").select("card_id").in("card_id", cardIds),
        supabase.from("likes").select("card_id").eq("user_id", user.id).in("card_id", cardIds),
        supabase.from("profiles").select("*").in("id", authorIds),
      ]);

      const profilesMap = new Map<string, Profile>();
      (profilesRes.data || []).forEach((p: any) =>
        profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar })
      );

      const likesCountMap = new Map<string, number>();
      (likesRes.data || []).forEach((l: any) => {
        likesCountMap.set(l.card_id, (likesCountMap.get(l.card_id) || 0) + 1);
      });

      const userLikedSet = new Set<string>((userLikesRes.data || []).map((l: any) => l.card_id));

      const merged: CardType[] = rawRoadmaps.map((r: any) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        category: r.category,
        user: profilesMap.get(r.user_id) || { id: r.user_id, username: "Unknown" },
        steps: ((r.steps || []) as Step[])
          .slice()
          .sort((a, b) => a.order - b.order),
        likesCount: likesCountMap.get(r.id) || 0,
        isLiked: userLikedSet.has(r.id),
        isFavorite: true,
      }));

      setCards(merged);
      setLoading(false);
    }

    loadFavorites();
  }, [router]);

  // Убираем карточку из списка при снятии закладки
  function handleUnfavorite(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
  }

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
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bookmark className="h-5 w-5 text-amber-400 fill-amber-400" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Избранное</h1>
            </div>
            <p className="text-sm text-slate-400">Сохранённые дорожные карты</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
          >
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
        </header>

        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 px-6 py-20 text-center backdrop-blur-md">
            <Bookmark className="mb-4 h-12 w-12 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-700 dark:text-slate-200">
              У вас пока нет сохранённых дорожных карт
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Нажмите на иконку закладки на любой карточке, чтобы добавить её в избранное.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              <ArrowLeft className="h-4 w-4" />
              На главную
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {cards.map((c) => (
              <FavoriteCardWrapper
                key={c.id}
                card={c}
                userId={userId}
                onUnfavorite={handleUnfavorite}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// Обёртка чтобы перехватить снятие закладки не уходя со страницы
function FavoriteCardWrapper({
  card,
  userId,
  onUnfavorite,
}: {
  card: CardType;
  userId: string | null;
  onUnfavorite: (id: string) => void;
}) {
  function handleClick(e: React.MouseEvent<HTMLDivElement>) {
    // Если клик по кнопке закладки внутри Card — убираем из списка
    const target = e.target as HTMLElement;
    const btn = target.closest("button");
    if (btn && btn.title.includes("Убрать")) {
      // Небольшая задержка, чтобы Card успел выполнить запрос
      setTimeout(() => onUnfavorite(card.id), 300);
    }
  }

  return (
    <div onClick={handleClick}>
      <Link href={`/card/${card.id}`} className="cursor-pointer h-full block">
        <Card
          card={card}
          userId={userId}
          initialLikesCount={card.likesCount}
          initialIsLiked={card.isLiked}
          initialIsFavorite={card.isFavorite}
        />
      </Link>
    </div>
  );
}
