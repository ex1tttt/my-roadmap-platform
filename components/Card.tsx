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
    <article className="rounded-lg border bg-white p-4 shadow-sm dark:bg-gray-900">
      <header className="mb-3 flex items-center gap-3">
        <img
          src={card.user.avatar || '/placeholder-avatar.png'}
          alt={card.user.username}
          className="h-10 w-10 rounded-full object-cover"
        />
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{card.title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">by {card.user.username}</p>
        </div>
      </header>

      {card.description && <div className="mb-3 text-sm text-gray-700 dark:text-gray-300">{card.description}</div>}

      <ol className="space-y-2 text-sm">
        {(card.steps || [])
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((step) => (
            <li key={step.id} className="flex gap-3">
              <div className="min-w-[28px] flex-none rounded-md bg-gray-100 p-1 text-center text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                {step.order}
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-gray-100">{step.title}</div>
                {step.content && <div className="text-gray-600 dark:text-gray-400">{step.content}</div>}
              </div>
            </li>
          ))}
      </ol>
    </article>
  );
}
