import { useState, useEffect, useRef } from "react";
import { Users, Trash2, Pin, MoreVertical, Pencil } from "lucide-react";
import Card from "@/components/Card";
import Link from "next/link";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

export default function ProfileTabsSelf({
  myCards,
  setMyCards,
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
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  // Для одиночного удаления
  const [cardToDelete, setCardToDelete] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  // Дропдаун три точки
  const [cardMenuOpenId, setCardMenuOpenId] = useState<string | null>(null);
  const cardMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardMenuOpenId) return;
    function handleClick(e: MouseEvent) {
      if (cardMenuRef.current && !cardMenuRef.current.contains(e.target as Node)) {
        setCardMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [cardMenuOpenId]);

  async function togglePinCard(cardId: string, currentStatus: boolean) {
    const newVal = !currentStatus;
    // Оптимистичное обновление
    setMyCards((prev: any[]) =>
      prev.map((c: any) => (c.id === cardId ? { ...c, is_pinned: newVal } : c))
    );
    const { error } = await supabase
      .from('cards')
      .update({ is_pinned: newVal })
      .eq('id', cardId);
    if (error) {
      // Откат
      setMyCards((prev: any[]) =>
        prev.map((c: any) => (c.id === cardId ? { ...c, is_pinned: currentStatus } : c))
      );
      toast.error('Ошибка при закреплении');
    } else {
      toast.success(newVal ? 'Карточка закреплена' : 'Откреплено');
    }
  }

  const handleSelectCard = (id: string) => {
    setSelectedCardIds((prev) =>
      prev.includes(id) ? prev.filter((cid) => cid !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (!selectedCardIds.length) return;
    setIsDeleteModalOpen(true);
  };

  const confirmBulkDelete = async () => {
    const { error } = await supabase.from('cards').delete().in('id', selectedCardIds);
    if (!error) {
      if (typeof setMyCards === 'function') {
        setMyCards((prev: any[]) => prev.filter((c) => !selectedCardIds.includes(c.id)));
      } else if (typeof handleDelete === 'function') {
        // fallback: вызвать handleDelete для каждой карточки
        selectedCardIds.forEach((id) => handleDelete(id));
      }
      setSelectedCardIds([]);
      setIsSelectionMode(false);
      setIsDeleteModalOpen(false);
      toast.success("Дорожные карты успешно удалены");
    } else {
      toast.error("Ошибка при удалении");
    }
  };

  const cancelBulkDelete = () => {
    setIsDeleteModalOpen(false);
  };

  // Кастомный toast для подтверждения удаления
  // cardId передаётся явно, т.к. setCardToDelete — асинхронный
  const confirmDelete = (cardId: string) => {
    const tId = toast(
      <div className="flex flex-col items-center gap-3 bg-slate-900 rounded-xl p-4">
        <span className="text-white text-sm mb-2">Вы уверены, что хотите удалить эту карточку?</span>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition"
            onClick={async () => {
              const { error } = await supabase.from('cards').delete().eq('id', cardId);
              if (!error) {
                setMyCards((prev: any[]) => prev.filter((c) => c.id !== cardId));
                toast.success("Карточка удалена", { id: tId });
              } else {
                toast.error("Ошибка при удалении", { id: tId });
              }
              setCardToDelete(null);
              setIsModalOpen(false);
              toast.dismiss(tId);
            }}
          >Удалить</button>
          <button
            className="px-3 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            onClick={() => {
              toast.dismiss(tId);
              setIsModalOpen(false);
              setCardToDelete(null);
            }}
          >Отмена</button>
        </div>
      </div>,
      { duration: 10000, id: 'delete-confirm', position: 'top-center' }
    );
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
          <DeleteModal />
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
              {[...myCards]
                .sort((a: any, b: any) => {
                  if (a.is_pinned && !b.is_pinned) return -1;
                  if (!a.is_pinned && b.is_pinned) return 1;
                  return 0;
                })
                .map((c: any) => (
                <div key={c.id} className="relative">
                  {/* Флажок выбора (режим массового удаления) */}
                  {isSelectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedCardIds.includes(c.id)}
                      onChange={() => handleSelectCard(c.id)}
                      className="absolute top-2 left-2 z-10 accent-blue-500"
                    />
                  )}

                  {/* Плашка «Закреплено» */}
                  {c.is_pinned && (
                    <div className="absolute top-0 left-0 z-10 rounded-tl-xl rounded-br-lg bg-blue-500 px-2 py-0.5 text-[10px] font-semibold text-white select-none pointer-events-none">
                      Закреплено
                    </div>
                  )}

                  {/* Три точки — меню карточки */}
                  {!isSelectionMode && (
                    <div ref={cardMenuOpenId === c.id ? cardMenuRef : undefined} className="absolute top-2 right-2 z-20">
                      <button
                        onClick={(e) => { e.stopPropagation(); setCardMenuOpenId(cardMenuOpenId === c.id ? null : c.id); }}
                        className="flex items-center justify-center rounded-md bg-white/80 dark:bg-slate-800/80 p-1.5 shadow-sm hover:bg-white dark:hover:bg-slate-700 transition-colors"
                        title="Действия"
                      >
                        <MoreVertical className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
                      </button>

                      {cardMenuOpenId === c.id && (
                        <div className="absolute right-0 top-7 min-w-35 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-xl overflow-hidden">
                          {/* Закрепить / Открепить */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardMenuOpenId(null);
                              togglePinCard(c.id, c.is_pinned ?? false);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <Pin className={`h-3.5 w-3.5 ${c.is_pinned ? 'fill-blue-500 text-blue-500' : 'text-slate-400'}`} />
                            {c.is_pinned ? 'Открепить' : 'Закрепить'}
                          </button>

                          {/* Изменить */}
                          <Link
                            href={`/card/${c.id}/edit`}
                            onClick={() => setCardMenuOpenId(null)}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                          >
                            <Pencil className="h-3.5 w-3.5 text-slate-400" />
                            Изменить
                          </Link>

                          {/* Разделитель */}
                          <div className="border-t border-slate-100 dark:border-white/5" />

                          {/* Удалить */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardMenuOpenId(null);
                              setCardToDelete(c.id);
                              setIsModalOpen(false);
                              confirmDelete(c.id);
                            }}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Удалить
                          </button>
                        </div>
                      )}
                    </div>
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
                      onLike={handleCardLike}
                      onFavorite={handleCardFavorite}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-stretch">
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
                  onLike={handleCardLike}
                  onFavorite={handleCardFavorite}
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
                  onLike={handleCardLike}
                  onFavorite={handleCardFavorite}
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
                  onLike={handleCardLike}
                  onFavorite={handleCardFavorite}
                />
              </div>
            ))}
          </div>
        )
      )}
    </>
  );

  function DeleteModal() {
    if (!isDeleteModalOpen) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="animate-fade-in animate-scale rounded-xl border border-slate-800 bg-[#0B0F1A] p-6 shadow-xl w-full max-w-xs text-center">
          <h2 className="text-lg font-semibold text-white mb-2">Удалить дорожную карту?</h2>
          <p className="text-sm text-slate-400 mb-4">Это действие необратимо. Вы уверены?</p>
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              className="px-4 py-2 rounded bg-transparent border border-slate-700 text-slate-400 hover:bg-slate-800 transition"
              onClick={cancelBulkDelete}
            >Отмена</button>
            <button
              type="button"
              className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition"
              onClick={confirmBulkDelete}
            >Удалить</button>
          </div>
        </div>
      </div>
    );
  }

  // SingleDeleteModal больше не нужен, confirmDelete теперь вызывает toast
}
