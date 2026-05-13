"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/Card";

type Step = { id: string; order: number; title: string; content?: string; media_url?: string };
type Profile = { id: string; username: string; avatar?: string };

interface RawCard {
  id: string;
  title: string;
  slug?: string;
  description?: string;
  category?: string;
  card_type?: "list" | "gantt" | null;
  user_id: string;
  steps?: Step[];
  gantt_tasks?: { id: string; title?: string | null; order?: number | null }[];
  _likesCount?: number;
  _isLiked?: boolean;
  _isFavorite?: boolean;
  _averageRating?: number;
  _commentsCount?: number;
  [key: string]: any;
}

interface Props {
  cards: RawCard[];
  profile: Profile;
  currentUserId: string | null;
}

export default function PublicProfileCards({ cards, profile, currentUserId }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((c) => (
        <div key={c.id} className="h-full">
          <Card
            card={{
              id: c.id,
              title: c.title,
              slug: c.slug,
              description: c.description,
              category: c.category,
              card_type: c.card_type ?? "list",
              user: profile,
              steps: (c.steps ?? []).sort((a: Step, b: Step) => a.order - b.order),
              gantt_tasks: [...(c.gantt_tasks ?? [])].sort(
                (a, b) => (a.order ?? 0) - (b.order ?? 0)
              ),
            }}
            initialLikesCount={c._likesCount ?? 0}
            initialIsLiked={c._isLiked ?? false}
            initialIsFavorite={c._isFavorite ?? false}
            initialAverageRating={c._averageRating ?? 0}
            initialCommentsCount={c._commentsCount ?? 0}
            userId={currentUserId}
          />
        </div>
      ))}
    </div>
  );
}
