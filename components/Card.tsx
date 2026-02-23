import React from 'react';

type Step = { id: string; order: number; title: string; content?: string; media_url?: string };
type Profile = { id: string; username: string; avatar?: string };
type CardType = {
  id: string;
  title: string;
  category?: string;
  description?: string;
  user: Profile;
  steps?: Step[];
};

export default function Card({ card }: { card: CardType }) {
  return (
    <article className="rounded-xl border border-white/10 bg-slate-900/50 p-4 backdrop-blur-md transition-all hover:border-white/20 hover:bg-slate-900/70">
      <header className="mb-3 flex items-center gap-3">
        <img
          src={card.user.avatar || '/placeholder-avatar.png'}
          alt={card.user.username}
          className="h-10 w-10 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <h3 className="w-full truncate text-sm font-semibold text-white line-clamp-1">{card.title}</h3>
          <p className="text-xs text-slate-400">by {card.user.username}</p>
        </div>
      </header>

      {card.description && <div className="mb-3 overflow-hidden text-sm text-slate-400 line-clamp-2">{card.description}</div>}

      <ol className="space-y-2 text-sm">
        {(card.steps || [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => (
            <li key={step.id} className="flex gap-3">
              <div className="min-w-[28px] flex-none rounded-md bg-white/5 p-1 text-center text-xs font-medium text-slate-300">
                {step.order}
              </div>
              <div>
                <div className="font-medium text-slate-200">{step.title}</div>
                {step.content && <div className="text-slate-400">{step.content}</div>}
              </div>
            </li>
          ))}
      </ol>
    </article>
  );
}
