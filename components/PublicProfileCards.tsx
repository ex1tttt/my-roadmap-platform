"use client";

import { useRouter } from "next/navigation";
import Card from "@/components/Card";

type Step = { id: string; order: number; title: string; content?: string; media_url?: string };
type Profile = { id: string; username: string; avatar?: string };

interface RawCard {
  id: string;
  title: string;
  description?: string;
  category?: string;
  user_id: string;
  steps?: Step[];
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
              description: c.description,
              category: c.category,
              user: profile,
              steps: (c.steps ?? []).sort((a: Step, b: Step) => a.order - b.order),
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
