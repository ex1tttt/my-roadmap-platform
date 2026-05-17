"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import { supabase } from "@/lib/supabase";

type BackdropCard = {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  category?: string;
  card_type?: "list" | "gantt" | null;
  user: { id: string; username: string; avatar?: string };
  steps?: { id: string; order: number; title: string }[];
  gantt_tasks?: { id: string; title?: string | null; order?: number | null }[];
  likesCount: number;
  commentsCount: number;
  averageRating: number;
};

const BACKDROP_LIMIT = 14;

export default function LoginBackdrop() {
  const [cards, setCards] = useState<BackdropCard[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: cardsData, error } = await supabase
        .from("cards")
        .select("id, title, slug, description, category, card_type, user_id")
        .eq("is_private", false)
        .order("created_at", { ascending: false })
        .limit(BACKDROP_LIMIT);

      if (error || !cardsData?.length || cancelled) return;

      const cardIds = cardsData.map((c) => c.id);
      const userIds = Array.from(new Set(cardsData.map((c) => c.user_id)));

      const [profilesRes, stepsRes, ganttRes, likesRes, ratingsRes, commentsRes] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar").in("id", userIds),
        supabase.from("steps").select("id, card_id, order, title").in("card_id", cardIds).order("order", { ascending: true }),
        supabase.from("gantt_tasks").select("id, card_id, title, order").in("card_id", cardIds).order("order", { ascending: true }),
        supabase.from("likes").select("card_id").in("card_id", cardIds),
        supabase.from("ratings").select("roadmap_id, rate").in("roadmap_id", cardIds),
        supabase.from("comments").select("roadmap_id").in("roadmap_id", cardIds),
      ]);

      if (cancelled) return;

      const profilesMap = new Map(
        (profilesRes.data ?? []).map((p) => [p.id, { id: p.id, username: p.username, avatar: p.avatar ?? undefined }])
      );

      const stepsByCard = new Map<string, BackdropCard["steps"]>();
      (stepsRes.data ?? []).forEach((s) => {
        const arr = stepsByCard.get(s.card_id) ?? [];
        arr.push({ id: s.id, order: s.order, title: s.title });
        stepsByCard.set(s.card_id, arr);
      });

      const ganttByCard = new Map<string, BackdropCard["gantt_tasks"]>();
      (ganttRes.data ?? []).forEach((g) => {
        const arr = ganttByCard.get(g.card_id) ?? [];
        arr.push({ id: g.id, title: g.title, order: g.order });
        ganttByCard.set(g.card_id, arr);
      });

      const likesCount = new Map<string, number>();
      (likesRes.data ?? []).forEach((l) => likesCount.set(l.card_id, (likesCount.get(l.card_id) ?? 0) + 1));

      const ratings = new Map<string, number[]>();
      (ratingsRes.data ?? []).forEach((r) => {
        const arr = ratings.get(r.roadmap_id) ?? [];
        arr.push(r.rate);
        ratings.set(r.roadmap_id, arr);
      });

      const commentsCount = new Map<string, number>();
      (commentsRes.data ?? []).forEach((c) =>
        commentsCount.set(c.roadmap_id, (commentsCount.get(c.roadmap_id) ?? 0) + 1)
      );

      const merged: BackdropCard[] = cardsData.map((c) => {
        const ratingValues = ratings.get(c.id) ?? [];
        const avg = ratingValues.length
          ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
          : 0;
        return {
          id: c.id,
          title: c.title,
          slug: c.slug ?? undefined,
          description: c.description ?? undefined,
          category: c.category ?? undefined,
          card_type: (c.card_type as "list" | "gantt" | null) ?? "list",
          user: profilesMap.get(c.user_id) ?? { id: c.user_id, username: "—" },
          steps: stepsByCard.get(c.id) ?? [],
          gantt_tasks: ganttByCard.get(c.id) ?? [],
          likesCount: likesCount.get(c.id) ?? 0,
          commentsCount: commentsCount.get(c.id) ?? 0,
          averageRating: avg,
        };
      });

      setCards(merged);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="grid h-full w-full grid-cols-2 gap-3 p-4 opacity-90 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4 lg:p-8 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.id} className="min-h-[200px] scale-[0.98]">
            <Card
              card={card}
              initialLikesCount={card.likesCount}
              initialCommentsCount={card.commentsCount}
              initialAverageRating={card.averageRating}
            />
          </div>
        ))}
      </div>
      <div className="absolute inset-0 bg-slate-50/85 backdrop-blur-md dark:bg-[#020617]/80" />
    </div>
  );
}
