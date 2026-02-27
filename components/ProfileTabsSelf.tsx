import { useState, useEffect } from "react";
import { Users, Trash2 } from "lucide-react";
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
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);

  const handleSelectCard = (id: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedCardIds.length) return;
    if (!window.confirm(`Удалить ${selectedCardIds.length} карточек навсегда?`)) return;
    const { error } = await supabase.from('cards').delete().in('id', selectedCardIds);
    if (!error) {
      setMyCards((prev: any[]) => prev.filter((c) => !selectedCardIds.includes(c.id)));
      setSelectedCardIds([]);
      setIsSelectionMode(false);
    }
  };

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
      {tab === 'my' && (
        <>
          <div className="flex gap-2 mb-4">
            <button className="btn btn-sm btn-outline" onClick={() => setIsSelectionMode((v) => !v)}>
              {isSelectionMode ? "Отмена" : "Выбрать"}
            </button>
            {isSelectionMode && selectedCardIds.length > 0 && (
              <button className="btn btn-sm btn-danger" onClick={handleBulkDelete}>
                <Trash2 className="inline-block mr-1 h-4 w-4" /> Удалить выбранные ({selectedCardIds.length})
              </button>
            )}
          </div>
          {myCards.length === 0 ? (
            <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-10 text-center">
              <p className="text-slate-500 dark:text-slate-400">У вас пока нет карточек</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
              {myCards.map((c: any) => (
                <div key={c.id} className="relative">
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedCardIds.includes(c.id)}
                      onChange={() => handleSelectCard(c.id)}
                      className="absolute top-2 left-2 z-10 accent-blue-500"
                    />
                  )}
                  <div
                    className={isSelectionMode ? "pointer-events-auto" : "cursor-pointer"}
                    onClick={isSelectionMode ? () => handleSelectCard(c.id) : undefined}
                  >
                    <Card
                      card={c}
                      userId={profile?.id}
                      initialIsLiked={c.isLiked}
                      initialIsFavorite={c.isFavorite}
                      initialLikesCount={c.likesCount}
                      initialAverageRating={c.averageRating}
                      initialCommentsCount={c.commentsCount}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'liked' && (
        likedCards.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-10 text-center">
            <p className="text-slate-500 dark:text-slate-400">У вас пока нет понравившихся карточек</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md/grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {likedCards.map((c: any) => (
              <div key={c.id} className="relative">
                <Card
                  card={c}
                  userId={profile?.id}
                  initialIsLiked={c.isLiked}
                  initialIsFavorite={c.isFavorite}
                  initialLikesCount={c.likesCount}
                  initialAverageRating={c.averageRating}
                  initialCommentsCount={c.commentsCount}
                />
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'favorites' && (
        favoriteCards.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-10 text-center">
            <p className="text-slate-500 dark:text-slate-400">У вас пока нет избранных карточек</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {favoriteCards.map((c: any) => (
              <div key={c.id} className="relative">
                <Card
                  card={c}
                  userId={profile?.id}
                  initialIsLiked={c.isLiked}
                  initialIsFavorite={c.isFavorite}
                  initialLikesCount={c.likesCount}
                  initialAverageRating={c.averageRating}
                  initialCommentsCount={c.commentsCount}
                />
              </div>
            ))}
          </div>
        )
      )}

      {tab === 'shared' && (
        sharedCards.length === 0 ? (
          <div className="rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-10 text-center">
            <p className="text-slate-500 dark:text-slate-400">У вас пока нет доступа к приватным карточкам других пользователей</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
            {sharedCards.map((c: any) => (
              <div key={c.id} className="relative">
                <Card
                  card={c}
                  userId={profile?.id}
                  initialIsLiked={c.isLiked}
                  initialIsFavorite={c.isFavorite}
                  initialLikesCount={c.likesCount}
                  initialAverageRating={c.averageRating}
                  initialCommentsCount={c.commentsCount}
                />
              </div>
            ))}
          </div>
        )
      )}
    </>
  );
}
