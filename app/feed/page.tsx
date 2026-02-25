"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import Card from "@/components/Card";
import UserAvatar from "@/components/UserAvatar";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { useTranslation } from "react-i18next";
import { Rss, Users, Check, Loader2 } from "lucide-react";

// ─── Типы ─────────────────────────────────────────────────────────────

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
  averageRating: number;
  commentsCount: number;
};
type SuggestedAuthor = {
  id: string;
  username: string;
  avatar: string | null;
  followersCount: number;
  isFollowing: boolean;
};

// ─── Мини-кнопка подписки ───────────────────────────────────────────────────

function MiniFollowButton({
  author,
  currentUserId,
  onChange,
}: {
  author: SuggestedAuthor;
  currentUserId: string;
  onChange: (id: string, following: boolean) => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const following = author.isFollowing;

  async function handle() {
    if (loading) return;
    setLoading(true);
    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", author.id);
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: currentUserId, following_id: author.id });
    }
    onChange(author.id, !following);
    setLoading(false);
  }

  return (
    <button
      onClick={handle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all disabled:opacity-50 ${
        following
          ? "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-red-400 hover:text-red-400 dark:hover:border-red-500 dark:hover:text-red-400"
          : "bg-blue-600 text-white hover:bg-blue-500"
      }`}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : following ? (
        <Check className="h-3 w-3" />
      ) : null}
      {following ? t("follow.subscribed") : t("follow.subscribe")}
    </button>
  );
}

// ─── Карточка рекомендованного автора ──────────────────────────────────────────

function AuthorCard({
  author,
  currentUserId,
  onChange,
}: {
  author: SuggestedAuthor;
  currentUserId: string;
  onChange: (id: string, following: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-4 py-3 transition-colors hover:border-slate-300 dark:hover:border-slate-700">
      <Link
        href={`/profile/${author.id}`}
        className="flex min-w-0 items-center gap-3"
      >
        <UserAvatar username={author.username} avatarUrl={author.avatar} size={40} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
            {author.username}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t("feed.followers", { count: author.followersCount })}
          </p>
        </div>
      </Link>
      <MiniFollowButton author={author} currentUserId={currentUserId} onChange={onChange} />
    </div>
  );
}

// ─── Главная страница ───────────────────────────────────────────────────────

export default function FeedPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SuggestedAuthor[]>([]);
  const [suggestedLoading, setSuggestedLoading] = useState(false);

  // Загружаем рекомендованных авторов когда лента пуста
  async function loadSuggested(uid: string, alreadyFollowing: string[]) {
    setSuggestedLoading(true);
    try {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, username, avatar")
        .neq("id", uid)
        .limit(30);

      if (!profilesData || profilesData.length === 0) return;

      const profileIds = profilesData.map((p: any) => p.id);

      // Считаем подписчиков для каждого профиля одним запросом
      const { data: followsData } = await supabase
        .from("follows")
        .select("following_id")
        .in("following_id", profileIds);

      const countMap = new Map<string, number>();
      (followsData ?? []).forEach((f: any) => {
        countMap.set(f.following_id, (countMap.get(f.following_id) ?? 0) + 1);
      });

      const alreadySet = new Set(alreadyFollowing);
      const authors: SuggestedAuthor[] = profilesData
        .filter((p: any) => !alreadySet.has(p.id))
        .map((p: any) => ({
          id: p.id,
          username: p.username,
          avatar: p.avatar ?? null,
          followersCount: countMap.get(p.id) ?? 0,
          isFollowing: false,
        }))
        .sort((a: SuggestedAuthor, b: SuggestedAuthor) => b.followersCount - a.followersCount)
        .slice(0, 5);

      setSuggested(authors);
    } finally {
      setSuggestedLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      // Проверяем авторизацию
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const uid = user.id;
      if (mounted) setUserId(uid);

      // Получаем список ID авторов, на которых подписан пользователь
      const { data: followData, error: followError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", uid);

      if (followError) {
        console.error("follows error:", followError);
        if (mounted) setLoading(false);
        return;
      }

      const followingIds = (followData ?? []).map((r: any) => r.following_id as string);

      if (followingIds.length === 0) {
        if (mounted) {
          setEmpty(true);
          setLoading(false);
          loadSuggested(uid, []);
        }
        return;
      }
      const { data: cardsData, error: cardsError } = await supabase
        .from("cards")
        .select("*")
        .in("user_id", followingIds)
        .order("created_at", { ascending: false });

      if (cardsError || !cardsData || cardsData.length === 0) {
        if (mounted) {
          setEmpty(true);
          setLoading(false);
          loadSuggested(uid, followingIds);
        }
        return;
      }

      const cardIds = cardsData.map((c: any) => c.id);
      const authorIds = Array.from(new Set(cardsData.map((c: any) => c.user_id)));

      // Шаг 3: параллельно загружаем все связанные данные
      const [stepsRes, profilesRes, likesRes, userLikesRes, userFavsRes, ratingsRes, commentsRes] =
        await Promise.all([
          supabase.from("steps").select("*").in("card_id", cardIds).order("order", { ascending: true }),
          supabase.from("profiles").select("*").in("id", authorIds),
          supabase.from("likes").select("card_id").in("card_id", cardIds),
          supabase.from("likes").select("card_id").eq("user_id", uid).in("card_id", cardIds),
          supabase.from("favorites").select("roadmap_id").eq("user_id", uid).in("roadmap_id", cardIds),
          supabase.from("ratings").select("roadmap_id, rate").in("roadmap_id", cardIds),
          supabase.from("comments").select("roadmap_id").in("roadmap_id", cardIds),
        ]);

      const profilesMap = new Map<string, Profile>();
      (profilesRes.data ?? []).forEach((p: any) =>
        profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar })
      );

      const stepsByCard = new Map<string, Step[]>();
      (stepsRes.data ?? []).forEach((s: any) => {
        const arr = stepsByCard.get(s.card_id) ?? [];
        arr.push({ id: s.id, order: s.order, title: s.title, content: s.content, media_url: s.media_url });
        stepsByCard.set(s.card_id, arr);
      });

      const likesCountMap = new Map<string, number>();
      (likesRes.data ?? []).forEach((l: any) =>
        likesCountMap.set(l.card_id, (likesCountMap.get(l.card_id) ?? 0) + 1)
      );

      const userLikedSet = new Set<string>((userLikesRes.data ?? []).map((l: any) => l.card_id));
      const userFavSet = new Set<string>((userFavsRes.data ?? []).map((f: any) => f.roadmap_id));

      const ratingsMap = new Map<string, number[]>();
      (ratingsRes.data ?? []).forEach((r: any) => {
        const arr = ratingsMap.get(r.roadmap_id) ?? [];
        arr.push(r.rate);
        ratingsMap.set(r.roadmap_id, arr);
      });
      const avgRatingMap = new Map<string, number>();
      ratingsMap.forEach((values, cardId) =>
        avgRatingMap.set(cardId, values.reduce((a, b) => a + b, 0) / values.length)
      );

      const commentsCountMap = new Map<string, number>();
      (commentsRes.data ?? []).forEach((cm: any) =>
        commentsCountMap.set(cm.roadmap_id, (commentsCountMap.get(cm.roadmap_id) ?? 0) + 1)
      );

      const merged: CardType[] = cardsData.map((c: any) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        category: c.category,
        user: profilesMap.get(c.user_id) ?? { id: c.user_id, username: "Unknown" },
        steps: stepsByCard.get(c.id) ?? [],
        likesCount: likesCountMap.get(c.id) ?? 0,
        isLiked: userLikedSet.has(c.id),
        isFavorite: userFavSet.has(c.id),
        averageRating: avgRatingMap.get(c.id) ?? 0,
        commentsCount: commentsCountMap.get(c.id) ?? 0,
      }));

      if (mounted) {
        setCards(merged);
        setEmpty(merged.length === 0);
        setLoading(false);
      }
    }

    load();
    return () => { mounted = false; };
  }, [router]);

  function handleSuggestedFollow(id: string, following: boolean) {
    setSuggested((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, isFollowing: following, followersCount: Math.max(0, following ? a.followersCount + 1 : a.followersCount - 1) }
          : a
      )
    );
  }

  function handleLike(cardId: string, isLiked: boolean) {
    setCards((prev) =>
      prev.map((c) =>
        c.id === cardId
          ? { ...c, isLiked, likesCount: Math.max(0, isLiked ? c.likesCount + 1 : c.likesCount - 1) }
          : c
      )
    );
  }

  function handleFavorite(cardId: string, isFavorite: boolean) {
    setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, isFavorite } : c)));
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#020617]">
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {/* Заголовок */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
            <Rss className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t("feed.title")}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t("feed.subtitle")}
            </p>
          </div>
        </div>

        {/* Скелетоны при загрузке */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Пустая лента + рекомендованные авторы */}
        {!loading && empty && (
          <div className="mx-auto max-w-xl">
            {/* Hero пустой ленты */}
            <div className="mb-8 flex flex-col items-center rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-8 py-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                <Rss className="h-7 w-7 text-slate-400" />
              </div>
              <p className="mb-1 text-lg font-semibold text-slate-700 dark:text-slate-200">
                {t("feed.emptyTitle")}
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t("feed.emptyHint")}
              </p>
            </div>

            {/* Рекомендованные авторы */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {t("feed.suggestedTitle")}
                </h2>
              </div>

              {suggestedLoading && (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 px-4 py-3">
                      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3.5 w-28 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                        <div className="h-2.5 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                      <div className="h-7 w-20 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
                    </div>
                  ))}
                </div>
              )}

              {!suggestedLoading && suggested.length > 0 && userId && (
                <div className="space-y-2.5">
                  {suggested.map((author) => (
                    <AuthorCard
                      key={author.id}
                      author={author}
                      currentUserId={userId}
                      onChange={handleSuggestedFollow}
                    />
                  ))}
                </div>
              )}

              {!suggestedLoading && suggested.length === 0 && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  {t("feed.noSuggested")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Карточки */}
        {!loading && !empty && cards.length > 0 && (
          <>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              {t("feed.count", { count: cards.length })}
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 items-stretch">
              {cards.map((c) => (
                <Card
                  key={c.id}
                  card={c}
                  userId={userId}
                  initialLikesCount={c.likesCount}
                  initialIsLiked={c.isLiked}
                  initialIsFavorite={c.isFavorite}
                  initialAverageRating={c.averageRating}
                  initialCommentsCount={c.commentsCount}
                  onLike={handleLike}
                  onFavorite={handleFavorite}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
