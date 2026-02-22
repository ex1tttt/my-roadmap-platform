"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Card from "../components/Card";
import Link from "next/link";

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

  useEffect(() => {
    let mounted = true;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const { data: cardsData, error: cardsError } = await supabase.from("cards").select("*");
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
  }, []);

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-6 dark:bg-black">
      <main className="mx-auto max-w-6xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Roadmaps</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">Карточки достижений от пользователей</p>
        </header>

        {loading ? (
          <div className="rounded-lg bg-white p-6 text-center shadow-sm">Загрузка...</div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 p-6 text-center text-red-700 shadow-sm">{error}</div>
        ) : cards.length === 0 ? (
          <div className="rounded-lg bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-medium text-gray-900 dark:text-gray-100">Пока нет ни одной дорожной карты</h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Создайте первую дорожную карту на странице создания.</p>
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
