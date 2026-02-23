"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Card from "../components/Card";
import Link from "next/link";
import { Search } from "lucide-react";

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
  }, [debouncedQuery]);

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-6 dark:bg-black">
      <main className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roadmaps</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Карточки достижений от пользователей</p>
        </header>

        {/* Поиск */}
        <div className="relative mb-8">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder-slate-500 outline-none transition-colors focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/20 dark:bg-zinc-900"
          />
        </div>

        {loading ? (
          <div className="rounded-lg bg-white p-6 text-center shadow-sm dark:bg-zinc-900 dark:text-slate-400">Загрузка...</div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-6 text-center text-red-700 shadow-sm">{error}</div>
        ) : cards.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm dark:bg-zinc-900">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              {debouncedQuery ? `Ничего не найдено по запросу «${debouncedQuery}»` : "Пока нет ни одной дорожной карты"}
            </h2>
            {!debouncedQuery && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Создайте первую дорожную карту на странице создания.</p>
            )}
          </div>
        ) : (
          <section>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
