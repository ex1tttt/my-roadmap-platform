"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Card from "../components/Card";
import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

type Step = { id: string; order: number; title: string; content?: string; media_url?: string };
type Profile = { id: string; username: string; avatar?: string };
type CardType = {
  id: string;
  title: string;
  description?: string;
  category?: string;
  user: Profile;
  steps?: Step[];
};

export default function Home() {
  const [cards, setCards] = useState<CardType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Debounce: обновляем debouncedQuery через 350ms после последнего ввода
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        let query = supabase.from("cards").select("*");
        if (debouncedQuery) {
          query = query.ilike("title", `%${debouncedQuery}%`);
        }
        if (selectedCategory) {
          query = query.eq("category", selectedCategory);
        }

        const { data: cardsData, error: cardsError } = await query;
        if (cardsError) throw cardsError;
        if (!cardsData || cardsData.length === 0) {
          if (mounted) setCards([]);
          return;
        }

        const cardIds = cardsData.map((c: any) => c.id);
        const userIds = Array.from(new Set(cardsData.map((c: any) => c.user_id)));

        const { data: stepsData, error: stepsError } = await supabase
          .from("steps")
          .select("*")
          .in("card_id", cardIds)
          .order("order", { ascending: true });
        if (stepsError) throw stepsError;

        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("*")
          .in("id", userIds);
        if (profilesError) throw profilesError;

        const profilesMap = new Map<string, Profile>();
        (profilesData || []).forEach((p: any) => profilesMap.set(p.id, { id: p.id, username: p.username, avatar: p.avatar }));

        const stepsByCard = new Map<string, Step[]>();
        (stepsData || []).forEach((s: any) => {
          const arr = stepsByCard.get(s.card_id) || [];
          arr.push({ id: s.id, order: s.order, title: s.title, content: s.content, media_url: s.media_url });
          stepsByCard.set(s.card_id, arr);
        });

        const merged = (cardsData || []).map((c: any) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          category: c.category,
          user: profilesMap.get(c.user_id) || { id: c.user_id, username: "Unknown" },
          steps: stepsByCard.get(c.id) || [],
        }));

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
  }, [debouncedQuery, selectedCategory]);

  return (
    <div className="min-h-screen bg-zinc-950 py-12 px-6">
      <main className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white">Roadmaps</h1>
          <p className="text-sm text-slate-400">Карточки достижений от пользователей</p>
        </header>

        {/* Поиск + Фильтры */}
        <div className="mb-8 flex items-center gap-2 w-full max-w-2xl">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по названию..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 rounded-lg border border-slate-800 bg-slate-900/50 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none backdrop-blur-md transition-colors focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 w-full"
            />
          </div>

          <div className="relative">
            <button
              onClick={() => setFiltersOpen((p) => !p)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900/80 border border-slate-800 rounded-lg text-slate-300 hover:text-white transition-all whitespace-nowrap"
            >
              <SlidersHorizontal size={18} />
              <span>Фильтры{selectedCategory ? `: ${selectedCategory}` : ''}</span>
            </button>

            {filtersOpen && (
              <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-xl border border-white/10 bg-slate-900/90 p-2 backdrop-blur-md shadow-xl">
                {['', 'frontend', 'datascience', 'devops'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setSelectedCategory(cat); setFiltersOpen(false); }}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedCategory === cat
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    {cat === '' ? 'Все категории' : cat === 'frontend' ? 'Frontend' : cat === 'datascience' ? 'Data Science' : 'DevOps'}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-6 text-center text-slate-400 backdrop-blur-md">Загрузка...</div>
        ) : error ? (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-6 text-center text-red-400">{error}</div>
        ) : cards.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-slate-900/50 p-8 text-center backdrop-blur-md">
            <h2 className="text-lg font-medium text-slate-200">
              {debouncedQuery || selectedCategory ? `Ничего не найдено` : "Пока нет ни одной дорожной карты"}
            </h2>
            {!debouncedQuery && !selectedCategory && (
              <p className="mt-2 text-sm text-slate-400">Создайте первую дорожную карту на странице создания.</p>
            )}
          </div>
        ) : (
          <section>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {cards.map((c) => (
                <Link key={c.id} href={`/card/${c.id}`} className="cursor-pointer">
                  <Card card={c} />
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
