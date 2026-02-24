"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Heart, Bookmark, MessageSquare, Star } from 'lucide-react';
import ShareButton from './ShareButton';

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
  initialAverageRating?: number;
  initialCommentsCount?: number;
  actions?: React.ReactNode;
  onLike?: (cardId: string, isLiked: boolean) => void;
  onFavorite?: (cardId: string, isFavorite: boolean) => void;
};

export default function Card({
  card,
  userId,
  initialLikesCount = 0,
  initialIsLiked = false,
  initialIsFavorite = false,
  initialAverageRating = 0,
  initialCommentsCount = 0,
  actions,
  onLike,
  onFavorite,
}: CardProps) {
  const router = useRouter();
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  async function handleLike(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId || likeLoading) return;

    const wasLiked = isLiked;
    const newLiked = !wasLiked;
    // Оптимистичное обновление до запроса
    setIsLiked(newLiked);
    setLikesCount((c) => Math.max(0, newLiked ? c + 1 : c - 1));
    onLike?.(card.id, newLiked);

    setLikeLoading(true);
    try {
      if (wasLiked) {
        const { error } = await supabase.from('likes').delete().eq('user_id', userId).eq('card_id', card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('likes').insert({ user_id: userId, card_id: card.id });
        if (error) throw error;
      }
    } catch {
      // Откатываем при ошибке
      setIsLiked(wasLiked);
      setLikesCount((c) => Math.max(0, wasLiked ? c + 1 : c - 1));
      onLike?.(card.id, wasLiked);
    } finally {
      setLikeLoading(false);
    }
  }

  async function handleFavorite(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!userId || favLoading) return;

    const wasFavorite = isFavorite;
    const newFavorite = !wasFavorite;
    // Оптимистичное обновление
    setIsFavorite(newFavorite);
    onFavorite?.(card.id, newFavorite);

    setFavLoading(true);
    try {
      if (wasFavorite) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('roadmap_id', card.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: userId, roadmap_id: card.id });
        if (error) throw error;
      }
    } catch {
      // Откатываем
      setIsFavorite(wasFavorite);
      onFavorite?.(card.id, wasFavorite);
    } finally {
      setFavLoading(false);
    }
  }

  return (
    <article
      className="relative w-full h-full flex flex-col min-h-[180px] rounded-xl border border-white/10 bg-slate-900/50 p-3 backdrop-blur-md transition-all hover:border-white/20 hover:bg-slate-900/70 cursor-pointer"
      onClick={() => router.push(`/card/${card.id}`)}
    >
      {actions && (
        <div className="absolute top-2 right-2 z-10">{actions}</div>
      )}
      <header className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${card.user.id}`); }}
          className="flex shrink-0 items-center gap-2 text-left hover:opacity-80 transition-opacity"
        >
          <img
            src={card.user.avatar || '/placeholder-avatar.png'}
            alt={card.user.username}
            className="h-8 w-8 rounded-full object-cover"
          />
        </button>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white">{card.title}</h3>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/profile/${card.user.id}`); }}
            className="text-xs text-slate-400 hover:text-blue-400 hover:underline transition-colors"
          >
            by {card.user.username}
          </button>
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

      {/* Лайки | Комментарии → Рейтинг | Избранное */}
      <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2.5">
        {/* Левая группа: лайки + комментарии */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleLike}
            disabled={!userId || likeLoading}
            title={userId ? (isLiked ? 'Убрать лайк' : 'Лайк') : 'Войдите, чтобы лайкнуть'}
            className={`flex items-center gap-1 text-xs transition-all duration-150 hover:scale-110 disabled:cursor-default disabled:opacity-40 ${
              isLiked ? 'text-red-400' : 'text-slate-500 hover:text-red-400'
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 transition-all ${
                isLiked ? 'fill-red-400 stroke-red-400' : ''
              }`}
            />
            <span>{likesCount > 0 ? likesCount : ''}</span>
          </button>

          <Link
            href={`/card/${card.id}#comments`}
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 text-xs transition-colors hover:text-blue-400 ${ initialCommentsCount > 0 ? 'text-slate-400' : 'text-slate-600' }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{initialCommentsCount}</span>
          </Link>
        </div>

        {/* Правая группа: рейтинг + избранное */}
        <div className="flex items-center gap-3">
          {initialAverageRating > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-400">
              <Star className="h-3.5 w-3.5 fill-amber-400 stroke-amber-400" />
              <span>{initialAverageRating.toFixed(1)}</span>
            </div>
          )}

          <button
            onClick={handleFavorite}
            disabled={!userId || favLoading}
            title={userId ? (isFavorite ? 'Убрать из избранного' : 'В избранное') : 'Войдите, чтобы добавить в избранное'}
            className={`flex items-center gap-1 text-xs transition-all duration-150 hover:scale-110 disabled:cursor-default disabled:opacity-40 ${
              isFavorite ? 'text-amber-400' : 'text-slate-500 hover:text-amber-400'
            }`}
          >
            <Bookmark
              className={`h-3.5 w-3.5 transition-all ${
                isFavorite ? 'fill-amber-400 stroke-amber-400' : ''
              }`}
            />
          </button>

          <ShareButton cardId={card.id} title={card.title} description={card.description} />
        </div>
      </div>
    </article>
  );
}
