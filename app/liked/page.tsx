
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Card from "@/components/Card";
import { Heart, Home } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useHasMounted } from "@/hooks/useHasMounted";

const ADMIN_IDS = [
  'a48b5f93-2e98-48c8-98f1-860ca962f651', // tkachmaksim2007
  'b63af445-e18d-4e5b-a0e1-ba747f2b4948', // atrybut2006
];

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
  averageRating?: number;
  commentsCount?: number;
};

export default function LikedPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const mounted = useHasMounted();
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadLiked() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUserId(user.id);
      setIsAdmin(ADMIN_IDS.includes(user.id));

      const { data: likesData, error } = await supabase
        .from("likes")
        .select("card_id")
        .eq("user_id", user.id);

      if (error || !likesData || likesData.length === 0) {
        setLoading(false);
        return;
      }

      const cardIds = likesData.map((l: any) => l.card_id);

      const [cardsRes, stepsRes, likesCountRes, userFavsRes, profilesAll] = await Promise.all([
        supabase.from("cards").select("*").order("created_at", { ascending: false }).in("id", cardIds),
        supabase.from("steps").select("*").in("card_id", cardIds).order("order", { ascending: true }),
        supabase.from("likes").select("card_id").in("card_id", cardIds),
        supabase.from("favorites").select("roadmap_id").eq("user_id", user.id).in("roadmap_id", cardIds),
        supabase.from("profiles").select("*"),
      ]);

      let cardsRaw = cardsRes.data ?? [];
      
      // Фильтруем приватные карточки: показываем только владельцу, администраторам и автору лайка
      cardsRaw = cardsRaw.filter(c => {
        if (!c.is_private) return true; // Публичные видны всем
        if (c.user_id === user.id) return true; // Владелец видит свои карточки
        if (ADMIN_IDS.includes(user.id)) return true; // Администраторы видят все
        return false; // Обычные пользователи не видят приватные карточки других
      });

      const profilesMap = new Map<string, Profile>();
      (profilesAll.data ?? []).forEach((p: any) =>
        profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar })
      );

      const stepsByCard = new Map<string, Step[]>();
      (stepsRes.data ?? []).forEach((s: any) => {
        const arr = stepsByCard.get(s.card_id) ?? [];
        arr.push({ id: s.id, order: s.order, title: s.title, content: s.content, media_url: s.media_url });
        stepsByCard.set(s.card_id, arr);
      });

      const likesCountMap = new Map<string, number>();
      (likesCountRes.data ?? []).forEach((l: any) =>
        likesCountMap.set(l.card_id, (likesCountMap.get(l.card_id) ?? 0) + 1)
      );

      const userFavSet = new Set<string>((userFavsRes.data ?? []).map((f: any) => f.roadmap_id));

      setCards(
        cardsRaw.map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          user: profilesMap.get(c.user_id) ?? { id: c.user_id, username: "Unknown" },
          steps: stepsByCard.get(c.id) ?? [],
          likesCount: likesCountMap.get(c.id) ?? 0,
          isLiked: true,
          isFavorite: userFavSet.has(c.id),
        }))
      );
      setLoading(false);
    }

    loadLiked();
  }, [router]);

  function handleUnlike(cardId: string) {
    setCards((prev) => prev.filter((c) => c.id !== cardId));
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
    <div className="min-h-screen bg-white dark:bg-[#020617] py-12 px-4 sm:px-6">
      <main className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Heart className="h-5 w-5 text-red-400 fill-red-400" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                {t("nav.liked")}
              </h1>
            </div>
            <p className="text-sm text-slate-400">{t("liked.subtitle")}</p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-slate-700 hover:text-slate-200"
          >
            <Home className="h-4 w-4" />
            {t("nav.backToHome")}
          </Link>
        </header>

        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/50 px-4 sm:px-6 py-20 text-center backdrop-blur-md">
            <Heart className="mb-4 h-12 w-12 text-slate-600" />
            <h2 className="text-lg font-medium text-slate-700 dark:text-slate-200">
              {t("liked.empty")}
            </h2>
            <p className="mt-2 text-sm text-slate-500">{t("liked.emptyHint")}</p>
            <Link
              href="/"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              <Home className="h-4 w-4" />
              {t("nav.backToHome")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {cards.map((c) => (
              <div key={c.id}>
                <Card
                  card={c}
                  userId={userId}
                  initialLikesCount={c.likesCount}
                  initialIsLiked={c.isLiked}
                  initialIsFavorite={c.isFavorite}
                  onLike={(cardId, isLiked) => {
                    if (!isLiked) setTimeout(() => handleUnlike(cardId), 300);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
