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
    <article className="max-w-[300px] mx-auto w-full h-full flex flex-col min-h-[180px] rounded-xl border border-white/10 bg-slate-900/50 p-3 backdrop-blur-md transition-all hover:border-white/20 hover:bg-slate-900/70">
      <header className="mb-2 flex items-center gap-2">
        <img
          src={card.user.avatar || '/placeholder-avatar.png'}
          alt={card.user.username}
          className="h-8 w-8 flex-none rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">{card.title}</h3>
          <p className="text-xs text-slate-400">by {card.user.username}</p>
        </div>
      </header>

      <div className="flex-grow min-h-[3rem] line-clamp-2 text-sm text-slate-400">
        {card.description || '\u00a0'}
      </div>

      <ol className="mt-auto space-y-1.5 text-xs">
        {(card.steps || [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => (
            <li key={step.id} className="flex gap-2">
              <div className="min-w-[22px] flex-none rounded bg-white/5 px-1 py-0.5 text-center font-medium text-slate-300">
                {step.order}
              </div>
              <div className="truncate font-medium text-slate-200">{step.title}</div>
            </li>
          ))}
      </ol>
    </article>
  );
}
