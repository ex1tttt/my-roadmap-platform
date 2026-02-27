"use client";

import React, { useRef, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { Heart, Bookmark, MessageSquare, Star, Download, Lock } from 'lucide-react';
import ShareButton from './ShareButton';
import UserAvatar from './UserAvatar';
import { useTranslation } from 'react-i18next';

type Step = { id: string; order: number; title: string; content?: string; media_url?: string };
type Profile = { id: string; username: string; avatar?: string };
type CardType = {
  id: string;
  title: string;
  category?: string;
  description?: string;
  user: Profile;
  steps?: Step[];
  is_private?: boolean;
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
  const cardRef = useRef<HTMLElement>(null);
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);
  const [isLiked, setIsLiked] = useState(initialIsLiked);
  const [isFavorite, setIsFavorite] = useState(initialIsFavorite);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [likeLoading, setLikeLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  useEffect(() => setMounted(true), []);

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

        // Уведомление владельцу карточки (не себе)
        if (card.user.id !== userId) {
          await supabase.from('notifications').insert({
            receiver_id: card.user.id,
            actor_id: userId,
            type: 'like',
            card_id: card.id,
          });
        }
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

  async function handleDownload(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const el = cardRef.current;
    if (!el) return;
    if (typeof window === 'undefined') return;
    try {
      // @ts-ignore — html-to-image не имеет поля exports, bundler-резолюция может не находить модуль
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, {
        cacheBust: true,
        backgroundColor: '#0f172a', // slate-900 — тёмный фон вместо прозрачного
        pixelRatio: 2,             // retina-качество
        logging: false,            // отключаем внутренние логи библиотеки
        filter: () => true,        // включаем все узлы DOM
        includeQueryParams: true,  // сохраняем query-параметры в URL ресурсов
        skipFonts: true,           // не встраиваем шрифты — избегаем ошибок путей на Windows
        fontEmbedCSS: '',          // пустой CSS шрифтов — отключаем Tailwind-font-lookup
      } as Parameters<typeof toPng>[1]);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${card.title.replace(/\s+/g, '-').toLowerCase()}.png`;
      link.click();
    } catch {
      // тихий fail — не логируем в консоль
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

  if (!mounted) return null;

  return (
    <article
      ref={cardRef}
      className="group relative w-full h-[200px] flex flex-col rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 p-3 backdrop-blur-md transition-all hover:border-slate-300 dark:hover:border-white/20 dark:hover:bg-slate-900/70 cursor-pointer overflow-hidden"
      onClick={() => router.push(`/card/${card.id}`)}
    >
      {/* Верхний блок: заголовок, автор, описание */}
      <div className="flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(card.user?.id) router.push(`/profile/${card.user.id}`); }}
            className="flex shrink-0 items-center gap-2 text-left hover:opacity-80 transition-opacity"
            disabled={!card.user?.id}
          >
            <UserAvatar
              username={card.user?.username ?? "??"}
              avatarUrl={card.user?.avatar}
              size={32}
            />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-white line-clamp-1">{card.title ?? "Без названия"}</h3>
              {card.is_private && (
                <span title="Приватная дорожная карта">
                  <Lock className="ml-1 h-4 w-4 text-blue-600 dark:text-blue-400" />
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); if(card.user?.id) router.push(`/profile/${card.user.id}`); }}
              className="text-xs text-slate-400 hover:text-blue-400 hover:underline transition-colors"
              disabled={!card.user?.id}
            >
              by {card.user?.username ?? "Автор неизвестен"}
            </button>
          </div>
        </div>
        <div className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400 mb-1 min-h-10">
          {card.description || '\u00a0'}
        </div>
      </div>
      {/* Блок шага */}
      <div className="flex flex-col">
        <ol className="text-xs max-h-[32px] overflow-hidden">
          {(card.steps && card.steps.length > 0)
            ? card.steps.slice().sort((a, b) => a.order - b.order).slice(0, 1).map((step) => (
                <li key={step.id} className="flex gap-2 items-center">
                  <div className="min-w-5.5 flex-none rounded bg-slate-100 dark:bg-white/5 px-1 text-center font-medium text-slate-600 dark:text-slate-300">
                    {step.order}
                  </div>
                  <div className="font-medium text-slate-700 dark:text-slate-200 line-clamp-2">{step.title}</div>
                </li>
              ))
            : <li className="text-xs text-slate-400 dark:text-slate-500">Нет шагов</li>
          }
          {card.steps && card.steps.length > 1 && (
            <li className="text-xs text-slate-400 dark:text-slate-500">
              + еще {card.steps.length - 1} шаг(ов)
            </li>
          )}
        </ol>
      </div>
      {/* Нижняя панель */}
      <div className="mt-auto flex items-center justify-between border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30 rounded-b-xl px-2 overflow-hidden">
        {/* Левая группа: лайки + комментарии */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleLike}
            disabled={!userId || likeLoading}
            title={userId ? (isLiked ? t('comments.dislike') : t('comments.like')) : t('auth.login')}
            className={`flex items-center gap-1 text-xs transition-all duration-150 hover:scale-110 disabled:cursor-default disabled:opacity-40 ${
              isLiked ? 'text-red-400' : 'text-slate-400 dark:text-slate-500 hover:text-red-400'
            }`}
          >
            <Heart
              className="h-3.5 w-3.5"
            />
            <span>{likesCount > 0 ? likesCount : ''}</span>
          </button>

          <Link
            href={`/card/${card.id}#comments`}
            onClick={(e) => e.stopPropagation()}
            className={`flex items-center gap-1 text-xs transition-colors hover:text-blue-400 ${ initialCommentsCount > 0 ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-600' }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span>{initialCommentsCount > 0 ? initialCommentsCount : ''}</span>
          </Link>
        </div>

        {/* Правая группа: рейтинг, избранное, share, download */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleFavorite}
            disabled={!userId || favLoading}
            title={userId ? (isFavorite ? t('cards.unfavorite') : t('cards.favorite')) : t('auth.login')}
            className={`flex items-center gap-1 text-xs transition-all duration-150 hover:scale-110 disabled:cursor-default disabled:opacity-40 ${
              isFavorite ? 'text-yellow-400' : 'text-slate-400 dark:text-slate-500 hover:text-yellow-400'
            }`}
          >
            <Bookmark
              className="h-3.5 w-3.5"
            />
          </button>

          {/* Рейтинг */}
          {typeof initialAverageRating === 'number' && initialAverageRating > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Star className="h-3.5 w-3.5" />
              {initialAverageRating.toFixed(1)}
            </span>
          )}

          {/* Share */}
          <ShareButton cardId={card.id} />

          {/* Download */}
          <button
            title={t('cards.download')}
            className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-blue-400 transition-colors"
            onClick={(e) => { e.stopPropagation(); /* download logic */ }}
          >
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
