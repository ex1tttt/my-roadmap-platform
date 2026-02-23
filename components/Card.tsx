"use client";

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Heart, Bookmark } from 'lucide-react';

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

type CardProps = {
  card: CardType;
  userId?: string | null;
  initialLikesCount?: number;
  initialIsLiked?: boolean;
  initialIsFavorite?: boolean;
};

export default function Card({
  card,
  userId,
  initialLikesCount = 0,
  initialIsLiked = false,
  initialIsFavorite = false,
}: CardProps) {
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId || likeLoading) return;
    setLikeLoading(true);
    try {
      if (isLiked) {
        await supabase.from('likes').delete().eq('user_id', userId).eq('card_id', card.id);
        setIsLiked(false);
        setLikesCount((c) => c - 1);
      } else {
        await supabase.from('likes').insert({ user_id: userId, card_id: card.id });
        setIsLiked(true);
        setLikesCount((c) => c + 1);
      }
    } finally {
      setLikeLoading(false);
    }
  }

  async function handleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId || favLoading) return;
    setFavLoading(true);
    try {
      if (isFavorite) {
        await supabase.from('favorites').delete().eq('user_id', userId).eq('card_id', card.id);
        setIsFavorite(false);
      } else {
        await supabase.from('favorites').insert({ user_id: userId, card_id: card.id });
        setIsFavorite(true);
      }
    } finally {
      setFavLoading(false);
    }
  }

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

      {/* Лайки и избранное */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
        <button
          onClick={handleLike}
          disabled={!userId || likeLoading}
          title={userId ? (isLiked ? 'Убрать лайк' : 'Лайк') : 'Войдите, чтобы лайкнуть'}
          className={`flex items-center gap-1.5 text-xs transition-all duration-150 hover:scale-110 disabled:cursor-default disabled:opacity-40 ${
            isLiked ? 'text-red-400' : 'text-slate-500 hover:text-red-400'
          }`}
        >
          <Heart
            className={`h-4 w-4 transition-all ${
              isLiked ? 'fill-red-400 stroke-red-400' : ''
            }`}
          />
          <span>{likesCount > 0 ? likesCount : ''}</span>
        </button>

        <button
          onClick={handleFavorite}
          disabled={!userId || favLoading}
          title={userId ? (isFavorite ? 'Убрать из избранного' : 'В избранное') : 'Войдите, чтобы добавить в избранное'}
          className={`flex items-center gap-1.5 text-xs transition-all duration-150 hover:scale-110 disabled:cursor-default disabled:opacity-40 ${
            isFavorite ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
          }`}
        >
          <Bookmark
            className={`h-4 w-4 transition-all ${
              isFavorite ? 'fill-amber-400 stroke-amber-400' : ''
            }`}
          />
        </button>
      </div>
    </article>
  );
}
