import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import Card from "@/components/Card";
import Link from "next/link";

export default function ProfileTabsSelf({
  myCards,
  likedCards,
  favoriteCards,
  sharedCards,
  profile,
  followersCount,
  followingCount,
  tab,
  setTab,
  favoritesCount,
  loading,
  favoritesLoading,
  displayed,
  handleCardLike,
  handleCardFavorite,
  handleDelete,
  openMenuId,
  setOpenMenuId,
  menuRef,
  t,
  modalMode,
  setModalMode,
  setFollowingCount
}: any) {
  const tabs = [
    { key: 'my', label: t('profile.myCards'), icon: null, count: myCards.length },
    { key: 'liked', label: t('profile.liked'), icon: null, count: likedCards.length },
    { key: 'favorites', label: t('nav.favorites'), icon: null, count: favoritesCount },
    { key: 'shared', label: 'Доступные мне', icon: <Users className="w-4 h-4 text-amber-500" />, count: sharedCards.length },
  ];

  return (
    <>
      <div className="mb-8 flex gap-1 border-b border-slate-200/60 dark:border-white/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`
              flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors
              border-b-2 -mb-px
              ${tab === t.key
                ? 'border-blue-500 text-blue-500'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100'
              }
            `}
          >
            {t.icon}
            {t.label}
            <span className={`
              rounded-full px-1.5 py-0.5 text-xs font-semibold
              ${tab === t.key
                ? 'bg-blue-500/15 text-blue-500'
                : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
              }
            `}>
              {t.count}
            </span>
          </button>
        ))}
      </div>
      {/* Контент вкладок */}
      {tab === 'shared' ? (
        sharedCards.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-10 text-center">
            <p className="text-slate-500 dark:text-slate-400">У вас пока нет доступа к приватным карточкам других пользователей</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {sharedCards.map((c: any) => (
              <div key={c.id} className="relative">
                <Card card={c} userId={profile?.id} />
              </div>
            ))}
          </div>
        )
      ) : null}
    </>
  );
}
