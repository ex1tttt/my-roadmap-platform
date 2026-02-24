"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import Card from "../components/Card";
import Link from "next/link";
import { Check, Search, SlidersHorizontal } from "lucide-react";
import { CardSkeleton } from "@/components/ui/CardSkeleton";

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

export default function Home() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("");
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Закрываем дропдаун при клике вне него
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // Получаем текущего пользователя один раз при монтировании
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  // Debounce: обновляем debouncedQuery через 350ms после последнего ввода
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Сбрасываем страницу при смене поиска, категории или сортировки
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedQuery, activeCategory, sortBy]);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const PAGE_SIZE = 16;
        let query = supabase
          .from("cards")
          .select("*", { count: 'exact' })
          .order("created_at", { ascending: false })
          .range((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE - 1);
        if (debouncedQuery) {
          query = query.ilike("title", `%${debouncedQuery}%`);
        }
        if (activeCategory) {
          query = query.eq("category", activeCategory);
        }

        const { data: cardsData, error: cardsError, count } = await query;
        if (cardsError) throw cardsError;
        if (mounted) setTotalCount(count ?? 0);
        if (!cardsData || cardsData.length === 0) {
          if (mounted) setCards([]);
          return;
        }

        const cardIds = cardsData.map((c: any) => c.id);
        const userIds = Array.from(new Set(cardsData.map((c: any) => c.user_id)));

        // Параллельно грузим шаги, профили, лайки, избранное, рейтинги и комментарии
        const [stepsRes, profilesRes, likesRes, userLikesRes, userFavsRes, ratingsRes, commentsRes] = await Promise.all([
          supabase.from("steps").select("*").in("card_id", cardIds).order("order", { ascending: true }),
          supabase.from("profiles").select("*").in("id", userIds),
          supabase.from("likes").select("card_id").in("card_id", cardIds),
          userId ? supabase.from("likes").select("card_id").eq("user_id", userId).in("card_id", cardIds) : Promise.resolve({ data: [] }),
          userId ? supabase.from("favorites").select("roadmap_id").eq("user_id", userId).in("roadmap_id", cardIds) : Promise.resolve({ data: [] }),
          supabase.from("ratings").select("roadmap_id, rate").in("roadmap_id", cardIds),
          supabase.from("comments").select("roadmap_id").in("roadmap_id", cardIds),
        ]);

        if (stepsRes.error) throw stepsRes.error;
        if (profilesRes.error) throw profilesRes.error;

        const profilesMap = new Map<string, Profile>();
        (profilesRes.data || []).forEach((p: any) => profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar }));

        const stepsByCard = new Map<string, Step[]>();
        (stepsRes.data || []).forEach((s: any) => {
          const arr = stepsByCard.get(s.card_id) || [];
          arr.push({ id: s.id, order: s.order, title: s.title, content: s.content, media_url: s.media_url });
          stepsByCard.set(s.card_id, arr);
        });

        // Считаем лайки per card
        const likesCountMap = new Map<string, number>();
        (likesRes.data || []).forEach((l: any) => {
          likesCountMap.set(l.card_id, (likesCountMap.get(l.card_id) || 0) + 1);
        });

        const userLikedSet = new Set<string>((userLikesRes.data || []).map((l: any) => l.card_id));
        const userFavSet = new Set<string>((userFavsRes.data || []).map((f: any) => f.roadmap_id));

        // Среднее рейтинга per card
        const ratingsMap = new Map<string, number[]>();
        (ratingsRes.data || []).forEach((r: any) => {
          const arr = ratingsMap.get(r.roadmap_id) || [];
          arr.push(r.rate);
          ratingsMap.set(r.roadmap_id, arr);
        });
        const avgRatingMap = new Map<string, number>();
        ratingsMap.forEach((values, cardId) => {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          avgRatingMap.set(cardId, avg);
        });

        const commentsCountMap = new Map<string, number>();
        (commentsRes.data || []).forEach((cm: any) => {
          commentsCountMap.set(cm.roadmap_id, (commentsCountMap.get(cm.roadmap_id) || 0) + 1);
        });

        const merged = (cardsData || []).map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          user: profilesMap.get(c.user_id) || { id: c.user_id, username: "Unknown" },
          steps: stepsByCard.get(c.id) || [],
          likesCount: likesCountMap.get(c.id) || 0,
          isLiked: userLikedSet.has(c.id),
          isFavorite: userFavSet.has(c.id),
          averageRating: avgRatingMap.get(c.id) ?? 0,
          commentsCount: commentsCountMap.get(c.id) ?? 0,
        }));

        if (sortBy === 'popular') {
          merged.sort((a, b) => b.averageRating - a.averageRating);
        }

        if (mounted) setCards(merged);
      } catch (err) {
        console.error(err);
        if (mounted) setError("Ошибка при загрузке данных");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchData();
    return () => {
      mounted = false;
    };
  }, [debouncedQuery, activeCategory, sortBy, userId, currentPage]);

  function handlePageChange(next: number) {
    setCurrentPage(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-6">
      <main className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Roadmaps</h1>
          <p className="text-sm text-slate-400">Карточки достижений от пользователей</p>
        </header>

        {/* Поиск + Фильтр + Сортировка */}
        <div className="mb-8 flex items-center gap-3 w-full">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none backdrop-blur-md transition-colors focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Переключатель сортировки */}
          <div className="flex shrink-0 items-center rounded-lg border border-slate-700 bg-slate-900/50 p-0.5">
            {([['newest', 'Новые'], ['popular', 'Популярные']] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setSortBy(val)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  sortBy === val
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Дропдаун категорий */}
          <div className="relative shrink-0" ref={filterRef}>
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                activeCategory
                  ? 'border-blue-500/60 bg-blue-600/20 text-blue-300'
                  : 'border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="h-4 w-4" />
              {activeCategory ? `Фильтр: ${activeCategory}` : 'Фильтры'}
            </button>

            {filterOpen && (
              <div className="absolute right-0 mt-2 w-52 rounded-xl border border-slate-700 bg-slate-900 py-1 shadow-xl z-50">
                {[
                  { value: '', label: 'Все категории' },
                  { value: 'Frontend', label: 'Frontend' },
                  { value: 'Backend', label: 'Backend' },
                  { value: 'Mobile Development', label: 'Mobile Development' },
                  { value: 'Data Science', label: 'Data Science' },
                  { value: 'Design', label: 'Design' },
                  { value: 'DevOps', label: 'DevOps' },
                  { value: 'Marketing', label: 'Marketing' },
                  { value: 'GameDev', label: 'GameDev' },
                  { value: 'Cybersecurity', label: 'Cybersecurity' },
                  { value: 'Soft Skills', label: 'Soft Skills' },
                ].map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => { setActiveCategory(cat.value); setFilterOpen(false); }}
                    className="flex w-full items-center justify-between px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    {cat.label}
                    {activeCategory === cat.value && (
                      <Check className="h-4 w-4 text-blue-400" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <section>
            <div ref={cardsRef} className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {Array(16).fill(0).map((_, i) => (
                <CardSkeleton key={'skeleton-' + i} />
              ))}
            </div>
            {/* Пагинация во время загрузки */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <button disabled className="rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-2 text-sm font-medium text-slate-300 disabled:cursor-not-allowed disabled:opacity-40">
                ← Назад
              </button>
              <span className="min-w-20 text-center text-sm font-medium text-slate-400">
                Страница {currentPage}
              </span>
              <button disabled className="rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-2 text-sm font-medium text-slate-300 disabled:cursor-not-allowed disabled:opacity-40">
                Вперёд →
              </button>
            </div>
          </section>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-6 text-center text-red-400">{error}</div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-8 text-center backdrop-blur-md">
            <h2 className="text-lg font-medium text-slate-200">
              {debouncedQuery || activeCategory ? `Ничего не найдено` : "Пока нет ни одной дорожной карты"}
            </h2>
            {!debouncedQuery && !activeCategory && (
              <p className="mt-2 text-sm text-slate-400">Создайте первую дорожную карту на странице создания.</p>
            )}
          </div>
        ) : (
          <section>
            <div ref={cardsRef} className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
              {cards.map((c) => (
                <div key={c.id} className="h-full">
                  <Card
                    card={c}
                    userId={userId}
                    initialLikesCount={c.likesCount}
                    initialIsLiked={c.isLiked}
                    initialIsFavorite={c.isFavorite}
                    initialAverageRating={c.averageRating}
                    initialCommentsCount={c.commentsCount}
                    onLike={(cardId, isLiked) =>
                      setCards((prev) =>
                        prev.map((x) =>
                          x.id === cardId
                            ? { ...x, isLiked, likesCount: Math.max(0, isLiked ? x.likesCount + 1 : x.likesCount - 1) }
                            : x
                        )
                      )
                    }
                    onFavorite={(cardId, isFavorite) =>
                      setCards((prev) =>
                        prev.map((x) => (x.id === cardId ? { ...x, isFavorite } : x))
                      )
                    }
                  />
                </div>
              ))}
            </div>

            {/* Пагинация */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Назад
              </button>
              <span className="min-w-20 text-center text-sm font-medium text-slate-400">
                Страница {currentPage}
              </span>
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage * 16 >= totalCount}
                className="rounded-lg border border-slate-700 bg-slate-900/50 px-5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Вперёд →
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
