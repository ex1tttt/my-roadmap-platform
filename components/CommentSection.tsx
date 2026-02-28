"use client";

import { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Trash2, MessageSquare, Send, User, ThumbsUp, ThumbsDown, ChevronDown, Pin } from 'lucide-react';
import { Skeleton } from '@/components/ui/Skeleton';
import Avatar from '@/components/UserAvatar';
import { useTranslation } from 'react-i18next';

// Тип комментария должен быть выше всех его использований
type AppComment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  is_pinned?: boolean
  parentAuthorName?: string
  parentAuthorUserId?: string
  author: {
    username: string
    avatar?: string
  }
  likesCount: number
  isLiked: boolean
  dislikesCount: number
  isDisliked: boolean
}

function ActionBar({ comment, currentUserId, onReaction, onReplyClick }: {
  comment: AppComment;
  currentUserId: string | null;
  onReaction: (id: string, type: 'like' | 'dislike') => void;
  onReplyClick: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
      {/* Лайк */}
      <button
        onClick={() => onReaction(comment.id, 'like')}
        className={`flex items-center gap-1 transition-colors hover:text-blue-500 ${comment.isLiked ? 'text-blue-500' : ''}`}
        aria-label={t('comments.like')}
      >
        <ThumbsUp size={16} className={comment.isLiked ? 'fill-blue-500' : ''} />
        {comment.likesCount > 0 && <span>{comment.likesCount}</span>}
      </button>
      {/* Дизлайк */}
      <button
        onClick={() => onReaction(comment.id, 'dislike')}
        className={`flex items-center gap-1 transition-colors hover:text-rose-500 ${comment.isDisliked ? 'text-rose-500' : ''}`}
        aria-label={t('comments.dislike')}
      >
        <ThumbsDown size={16} className={comment.isDisliked ? 'fill-rose-500' : ''} />
        {comment.dislikesCount > 0 && <span>{comment.dislikesCount}</span>}
      </button>
      {/* Ответить */}
      {currentUserId && (
        <button
          onClick={() => onReplyClick(comment.id)}
          className="font-semibold transition-colors hover:text-blue-500"
        >
          {t('comments.reply')}
        </button>
      )}
    </div>
  );
}

// Основные пропсы для строки комментария
interface CommentRowProps {
  comment: AppComment;
  currentUserId: string | null;
  cardOwnerId: string | null;
  deletingId: string | null;
  replyingTo: string | null;
  replyText: string;
  replySending: boolean;
  onDelete: (id: string) => void;
  onReplyClick: (id: string) => void;
  onReplyTextChange: (t: string) => void;
  onReplySubmit: (id: string) => void;
  onReplyCancel: () => void;
  onReaction: (id: string, type: 'like' | 'dislike') => void;
}

// Интерфейс для корневого комментария
interface RootCommentRowProps extends CommentRowProps {
  replies: AppComment[];
  expanded: boolean;
  onToggle: () => void;
  onPin: (comment: AppComment) => void;
}
function RootCommentRow(props: RootCommentRowProps) {
  const { comment, replies, expanded, onToggle, onPin, ...rest } = props;
  const { t, i18n } = useTranslation();
  const isReplying = rest.replyingTo === comment.id;
  return (
    <div className={`group flex gap-3 ${comment.is_pinned ? 'border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/10 pl-2' : ''}`}>
      <Avatar username={comment.author.username} avatarUrl={comment.author.avatar} size={40} />
      <div className="min-w-0 flex-1">
        {/* Имя + дата + удалить + pin */}
        <div className="flex items-center gap-2">
          <Link
            href={`/profile/${comment.user_id}`}
            className="text-sm font-semibold text-slate-200 underline-offset-2 transition-colors hover:text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {comment.author.username}
          </Link>
          <span className="text-xs text-slate-500">{formatDate(comment.created_at, i18n.language)}</span>
          {/* Кнопка Pin только для автора карточки */}
          {rest.currentUserId && rest.currentUserId === rest.cardOwnerId && (
            <button
              onClick={() => onPin(comment)}
              title={comment.is_pinned ? t('comments.unpin') : t('comments.pin')}
              className={`ml-2 flex h-6 w-6 items-center justify-center rounded text-yellow-500 transition-all hover:bg-yellow-100 dark:hover:bg-yellow-900/30 ${comment.is_pinned ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'opacity-60 group-hover:opacity-100'}`}
            >
              <Pin className="h-4 w-4" fill={comment.is_pinned ? '#facc15' : 'none'} />
            </button>
          )}
          {(comment.user_id === rest.currentUserId || (rest.currentUserId !== null && rest.currentUserId === rest.cardOwnerId)) && (
            <button
              onClick={() => rest.onDelete(comment.id)}
              disabled={rest.deletingId === comment.id}
              title={t('comments.delete')}
              className="ml-auto flex h-6 w-6 items-center justify-center rounded text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Закреплено */}
        {comment.is_pinned && (
          <div className="mb-1 text-xs font-semibold text-yellow-600 dark:text-yellow-400">Закреплено автором</div>
        )}

        {/* Текст */}
        <p className="mt-1 wrap-break-word overflow-anywhere whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {comment.content}
        </p>

        {/* Панель действий */}
        <ActionBar
          comment={comment}
          currentUserId={rest.currentUserId}
          onReaction={rest.onReaction}
          onReplyClick={rest.onReplyClick}
        />

        {/* Форма ответа */}
        {isReplying && (
          <ReplyForm
            replyText={rest.replyText}
            replySending={rest.replySending}
            parentId={comment.id}
            onReplyTextChange={rest.onReplyTextChange}
            onReplySubmit={rest.onReplySubmit}
            onReplyCancel={rest.onReplyCancel}
          />
        )}

        {/* Кнопка «Развернуть ответы» */}
        {replies.length > 0 && (
          <button
            onClick={onToggle}
            className="mt-2 flex items-center gap-1 text-sm font-medium text-blue-400 transition-colors hover:text-blue-300"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
            />
            {expanded
              ? t('comments.hideReplies')
              : t('comments.showReplies', { count: replies.length })}
          </button>
        )}
      </div>
    </div>
  );
}

function formatDate(iso: string, locale?: string): string {
  return new Date(iso).toLocaleDateString(locale ?? 'en', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Оптимистично обновляет реакцию (лайк/дизлайк) с YouTube-логикой */
/**
 * Оптимистично обновляет реакцию (лайк/дизлайк) с YouTube-логикой
 * @param flat - массив комментариев
 * @param commentId - id комментария
 * @param type - 'like' | 'dislike'
 */
function updateFlatReaction(
  flat: AppComment[],
  commentId: string,
  type: 'like' | 'dislike'
): AppComment[] {
  return flat.map((c) => {
    if (c.id !== commentId) return c;
    if (type === 'like') {
      if (c.isLiked) {
        return { ...c, isLiked: false, likesCount: Math.max(0, c.likesCount - 1) };
      }
      return {
        ...c,
        isLiked: true,
        likesCount: c.likesCount + 1,
        isDisliked: false,
        dislikesCount: c.isDisliked ? Math.max(0, c.dislikesCount - 1) : c.dislikesCount,
      };
    } else if (type === 'dislike') {
      if (c.isDisliked) {
        return { ...c, isDisliked: false, dislikesCount: Math.max(0, c.dislikesCount - 1) };
      }
      return {
        ...c,
        isDisliked: true,
        dislikesCount: c.dislikesCount + 1,
        isLiked: false,
        likesCount: c.isLiked ? Math.max(0, c.likesCount - 1) : c.likesCount,
      };
    }
    return c;
  });
}

/** Все потомки комментария (BFS по плоскому массиву) */
function getDescendants(flat: AppComment[], rootId: string): AppComment[] {
  const childIds = new Set<string>()
  const queue = [rootId]
  while (queue.length) {
    const id = queue.shift()!
    flat.filter((c) => c.parent_id === id).forEach((c) => {
      childIds.add(c.id)
      queue.push(c.id)
    })
  }
  // Порядок совпадает с порядком в flat (created_at desc — новые первые)
  return flat.filter((c) => childIds.has(c.id))
}

/** Склонение слова «ответ» — заменён на i18next */
// pluralReplies removed — used t('comments.showReplies') instead

/* ─── Форма ответа ──────────────────────────────────────────────── */
function ReplyForm({
  replyText,
  replySending,
  parentId,
  onReplyTextChange,
  onReplySubmit,
  onReplyCancel,
}: {
  replyText: string
  replySending: boolean
  parentId: string
  onReplyTextChange: (t: string) => void
  onReplySubmit: (id: string) => void
  onReplyCancel: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-50 dark:bg-slate-900/60 p-3">
      <textarea
        autoFocus
        value={replyText}
        onChange={(e) => onReplyTextChange(e.target.value)}
        placeholder={t('comments.replyPlaceholder')}
        rows={2}
        className="w-full resize-none bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
      />
      <div className="mt-2 flex items-center justify-end gap-2 border-t border-slate-200 dark:border-white/5 pt-2">
        <button
          onClick={onReplyCancel}
          className="px-3 py-1 text-xs text-slate-500 dark:text-slate-400 transition-colors hover:text-slate-800 dark:hover:text-slate-200"
        >
          {t('comments.cancel')}
        </button>
        <button
          disabled={!replyText.trim() || replySending}
          onClick={() => onReplySubmit(parentId)}
          className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="h-3 w-3" />
          {replySending ? t('comments.sending') : t('comments.reply')}
        </button>
      </div>
    </div>
  )
}
/* ─── Строка ответа (плоская, ml-12) ─────────────────────────── */
function ReplyRow({ comment, ...rest }: CommentRowProps) {
  const { t, i18n } = useTranslation()
  const isReplying = rest.replyingTo === comment.id
  return (
    <div className="group ml-12 flex gap-2">
      <Avatar username={comment.author.username} avatarUrl={comment.author.avatar} size={24} />
      <div className="min-w-0 flex-1">
        {/* Имя + дата + удалить */}
        <div className="flex items-center gap-2">
          <Link
            href={`/profile/${comment.user_id}`}
            className="text-sm font-semibold text-slate-700 dark:text-slate-200 underline-offset-2 transition-colors hover:text-blue-500 dark:hover:text-blue-400 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {comment.author.username}
          </Link>
          <span className="text-xs text-slate-500">{formatDate(comment.created_at, i18n.language)}</span>
          {(comment.user_id === rest.currentUserId || (rest.currentUserId !== null && rest.currentUserId === rest.cardOwnerId)) && (
            <button
              onClick={() => rest.onDelete(comment.id)}
              disabled={rest.deletingId === comment.id}
              title={t('comments.delete')}
              className="ml-auto flex h-6 w-6 items-center justify-center rounded text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Текст с @упоминанием */}
        <p className="mt-1 wrap-break-word overflow-anywhere whitespace-pre-wrap text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {comment.parentAuthorName && (
            <Link
              href={`/profile/${comment.parentAuthorUserId}`}
              className="mr-1 font-medium text-blue-400 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              @{comment.parentAuthorName}
            </Link>
          )}
          {comment.content}
        </p>

        {/* Панель действий */}
        <ActionBar
          comment={comment}
          currentUserId={rest.currentUserId}
          onReaction={rest.onReaction}
          onReplyClick={rest.onReplyClick}
        />

        {/* Форма ответа */}
        {isReplying && (
          <ReplyForm
            replyText={rest.replyText}
            replySending={rest.replySending}
            parentId={comment.id}
            onReplyTextChange={rest.onReplyTextChange}
            onReplySubmit={rest.onReplySubmit}
            onReplyCancel={rest.onReplyCancel}
          />
        )}
      </div>
    </div>
  )
}
/* ─── Основной компонент ────────────────────────────────────────── */
export default function CommentSection({ roadmapId }: { roadmapId: string }) {
  const [flat, setFlat] = useState<AppComment[]>([])
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<{ username: string; avatar?: string } | null>(null)
  const [cardOwnerId, setCardOwnerId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { t, i18n } = useTranslation()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    // Загружаем автора карточки
    supabase.from('cards').select('user_id').eq('id', roadmapId).maybeSingle()
      .then(({ data }) => setCardOwnerId(data?.user_id ?? null))

    supabase.auth.getSession().then(async ({ data }) => {
      const userId = data.session?.user?.id ?? null
      setCurrentUserId(userId)
      if (userId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar')
          .eq('id', userId)
          .single()
        setCurrentUserProfile(profile ?? null)
      }
    })
  }, [])

  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, parent_id, is_pinned, profiles:user_id(username, avatar), parentComment:parent_id(user_id, profiles:user_id(username))')
      .eq('roadmap_id', roadmapId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки комментариев:', error)
      setLoading(false)
      return
    }

    const ids = (data ?? []).map((c: any) => c.id as string)

    const [{ data: allLikes }, { data: myLikes }, { data: allDislikes }, { data: myDislikes }] = await Promise.all([
      ids.length
        ? supabase.from('comment_likes').select('comment_id').in('comment_id', ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length && currentUserId
        ? supabase.from('comment_likes').select('comment_id').in('comment_id', ids).eq('user_id', currentUserId)
        : Promise.resolve({ data: [] as any[] }),
      ids.length
        ? supabase.from('comment_dislikes').select('comment_id').in('comment_id', ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length && currentUserId
        ? supabase.from('comment_dislikes').select('comment_id').in('comment_id', ids).eq('user_id', currentUserId)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const likesMap = new Map<string, number>()
    ;(allLikes ?? []).forEach((l: any) => {
      likesMap.set(l.comment_id, (likesMap.get(l.comment_id) ?? 0) + 1)
    })
    const dislikesMap = new Map<string, number>()
    ;(allDislikes ?? []).forEach((l: any) => {
      dislikesMap.set(l.comment_id, (dislikesMap.get(l.comment_id) ?? 0) + 1)
    })
    const likedSet = new Set<string>((myLikes ?? []).map((l: any) => l.comment_id as string))
    const dislikedSet = new Set<string>((myDislikes ?? []).map((l: any) => l.comment_id as string))

    const result: AppComment[] = (data ?? []).map((c: any) => {
      const pc = c.parentComment
      const pcProfiles = pc ? (Array.isArray(pc.profiles) ? pc.profiles[0] : pc.profiles) : null
      return {
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_id: c.user_id,
        parent_id: c.parent_id ?? null,
        is_pinned: c.is_pinned ?? false,
        parentAuthorName: pcProfiles?.username ?? undefined,
        parentAuthorUserId: pc?.user_id ?? undefined,
        author: Array.isArray(c.profiles)
          ? (c.profiles[0] ?? { username: 'Unknown' })
          : (c.profiles ?? { username: 'Unknown' }),
        likesCount: likesMap.get(c.id) ?? 0,
        isLiked: likedSet.has(c.id),
        dislikesCount: dislikesMap.get(c.id) ?? 0,
        isDisliked: dislikedSet.has(c.id),
      }
    })

    setTotalCount(result.length)
    setFlat(result)
    setLoading(false)
  }

  useEffect(() => {
    setLoading(true)
    fetchComments()
  }, [roadmapId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !currentUserId || sending) return

    // Валидация перед отправкой
    if (!trimmed || !roadmapId || !currentUserId) {
      toast.error('Данные не полные')
      return
    }

    setSending(true)
    setText('')

    // Debug-лог перед отправкой в Supabase
    console.log('Данные перед отправкой:', {
      content: trimmed,
      roadmap_id: String(roadmapId),
      user_id: currentUserId,
    })

    // Optimistic Update — добавляем коммент в список немедленно
    const tempId = `optimistic-${Date.now()}`
    const optimisticComment: AppComment = {
      id: tempId,
      content: trimmed,
      created_at: new Date().toISOString(),
      user_id: currentUserId,
      parent_id: null,
      author: currentUserProfile ?? { username: 'Вы' },
      likesCount: 0,
      isLiked: false,
      dislikesCount: 0,
      isDisliked: false,
    }
    setFlat((prev) => [optimisticComment, ...prev])
    setTotalCount((prev) => prev + 1)

    const { data, error } = await supabase
      .from('comments')
      .insert({ roadmap_id: String(roadmapId), user_id: currentUserId, content: trimmed })
      .select('id, content, created_at, user_id, parent_id, profiles:user_id(username, avatar)')
      .single()

    if (error) {
      console.log("ПОЛНАЯ ОШИБКА:", JSON.stringify(error, null, 2))
      // Откат оптимистичного обновления
      setFlat((prev) => prev.filter((c) => c.id !== tempId))
      setTotalCount((prev) => prev - 1)
      setText(trimmed)
    } else {
      // Заменяем временный коммент реальным (с настоящим id и created_at)
      const newComment: AppComment = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        parent_id: null,
        author: Array.isArray(data.profiles)
          ? (data.profiles[0] ?? { username: 'Unknown' })
          : (data.profiles ?? { username: 'Unknown' }),
        likesCount: 0,
        isLiked: false,
        dislikesCount: 0,
        isDisliked: false,
      }
      setFlat((prev) => prev.map((c) => (c.id === tempId ? newComment : c)))
      textareaRef.current?.focus()
    }
    setSending(false)
  }

  async function handleReplySubmit(parentId: string) {
    const trimmed = replyText.trim()
    if (!trimmed || !currentUserId || replySending) return
    setReplySending(true)
    // Запоминаем автора родителя до отправки
    const parentComment = flat.find((c) => c.id === parentId)
    const { data, error } = await supabase
      .from('comments')
      .insert({ roadmap_id: roadmapId, user_id: currentUserId, content: trimmed, parent_id: parentId })
      .select('id, content, created_at, user_id, parent_id, profiles:user_id(username, avatar)')
      .single()
    if (error) {
      console.error(error)
    } else {
      const newReply: AppComment = {
        id: data.id,
        content: data.content,
        created_at: data.created_at,
        user_id: data.user_id,
        parent_id: parentId,
        parentAuthorName: parentComment?.author.username,
        parentAuthorUserId: parentComment?.user_id,
        author: Array.isArray(data.profiles)
          ? (data.profiles[0] ?? { username: 'Unknown' })
          : (data.profiles ?? { username: 'Unknown' }),
        likesCount: 0,
        isLiked: false,
        dislikesCount: 0,
        isDisliked: false,
      }
      setReplyText('')
      setReplyingTo(null)
      // Новый ответ — в начало flat; getDescendants вернёт его первым (новые сверху)
      setFlat((prev) => [newReply, ...prev])
      setTotalCount((prev) => prev + 1)
      // Авто-раскрываем ветку родителя
      setExpandedIds((prev) => new Set([...prev, parentId]))
    }
    setReplySending(false)
  }

  async function handleReaction(commentId: string, type: 'like' | 'dislike') {
    if (!currentUserId) return
    // Снимаем состояние ДО обновления для правильной логики
    const current = flat.find((c) => c.id === commentId)
    if (!current) return
    // Оптимистичное обновление
    setFlat((prev) => updateFlatReaction(prev, commentId, type))

    if (type === 'like') {
      if (current.isLiked) {
        await supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
      } else {
        await Promise.all([
          supabase.from('comment_likes').upsert({ comment_id: commentId, user_id: currentUserId }),
          current.isDisliked
            ? supabase.from('comment_dislikes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
            : Promise.resolve(),
        ])
      }
    } else {
      if (current.isDisliked) {
        await supabase.from('comment_dislikes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
      } else {
        await Promise.all([
          supabase.from('comment_dislikes').upsert({ comment_id: commentId, user_id: currentUserId }),
          current.isLiked
            ? supabase.from('comment_likes').delete().eq('comment_id', commentId).eq('user_id', currentUserId)
            : Promise.resolve(),
        ])
      }
    }
  }

  async function handleDelete(commentId: string) {
    if (deletingId) return
    setDeletingId(commentId)
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (!error) await fetchComments()
    setDeletingId(null)
  }

  function handleReplyClick(id: string) {
    setReplyingTo((prev) => (prev === id ? null : id))
    setReplyText('')
  }

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Корневые комментарии (без parent_id), закреплённые сверху
  const roots = useMemo(() => {
    const arr = flat.filter((c) => c.parent_id === null)
    return [
      ...arr.filter((c) => c.is_pinned),
      ...arr.filter((c) => !c.is_pinned)
    ]
  }, [flat])

  // Общие пропсы для строк
  async function togglePinComment(comment: AppComment) {
    if (!cardOwnerId || currentUserId !== cardOwnerId) return;
    // Оптимистичное обновление flat
    setFlat((prev) => {
      // Сначала все is_pinned = false, потом только выбранный true (если закрепляем)
      if (!comment.is_pinned) {
        return prev.map((c) =>
          c.id === comment.id
            ? { ...c, is_pinned: true }
            : { ...c, is_pinned: false }
        );
      } else {
        // Открепляем
        return prev.map((c) =>
          c.id === comment.id ? { ...c, is_pinned: false } : c
        );
      }
    });
    // Серверные запросы
    if (!comment.is_pinned) {
      await supabase.from('comments').update({ is_pinned: false }).eq('roadmap_id', roadmapId).eq('is_pinned', true);
    }
    const { error } = await supabase.from('comments').update({ is_pinned: !comment.is_pinned }).eq('id', comment.id);
    if (!error) {
      toast.success(!comment.is_pinned ? 'Комментарий закреплен' : 'Комментарий откреплен');
    } else {
      // Откат flat при ошибке
      setFlat((prev) => prev.map((c) =>
        c.id === comment.id ? { ...c, is_pinned: comment.is_pinned } : c
      ));
      toast.error('Ошибка закрепления');
    }
  }

  const rowProps = {
    currentUserId,
    cardOwnerId,
    deletingId,
    replyingTo,
    replyText,
    replySending,
    onDelete: handleDelete,
    onReplyClick: handleReplyClick,
    onReplyTextChange: setReplyText,
    onReplySubmit: handleReplySubmit,
    onReplyCancel: () => { setReplyingTo(null); setReplyText('') },
    onReaction: handleReaction,
    // onPin не нужен для ReplyRow и не должен попадать в RootCommentRow через spread
  }

  if (!mounted) return null

  return (
    <section className="mt-12">
      <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-800 dark:text-slate-200">
        <MessageSquare className="h-5 w-5 text-blue-400" />
        {t('comments.title')}
        {!loading && (
          <span className="ml-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
            {totalCount}
          </span>
        )}
      </h2>

      {/* Форма верхнего уровня */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/60 p-4 backdrop-blur-sm transition-colors focus-within:border-blue-500/40">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={currentUserId ? t('comments.placeholder') : t('comments.loginToComment')}
            disabled={!currentUserId || sending}
            rows={3}
            className="w-full resize-none bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="mt-3 flex justify-end border-t border-slate-200 dark:border-white/5 pt-3">
            <button
              type="submit"
              disabled={!currentUserId || !text.trim() || sending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {sending ? t('comments.sending') : t('comments.send')}
            </button>
          </div>
        </div>
      </form>

      {/* Список комментариев */}
      {loading ? (
        <div className="space-y-6">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2 pt-1">
                <Skeleton className="h-3 w-36 rounded" />
                <Skeleton className="h-3 w-3/4 rounded" />
                <Skeleton className="h-3 w-1/2 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : roots.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900/30 p-8 text-center text-slate-500">
          {t('comments.noComments')}
        </div>
      ) : (
        <ul className="space-y-6">
          {roots.map((root) => {
            const replies = getDescendants(flat, root.id)
            const expanded = expandedIds.has(root.id)
            return (
              <li key={root.id}>
                <RootCommentRow
                  comment={root}
                  replies={replies}
                  expanded={expanded}
                  onToggle={() => toggleExpanded(root.id)}
                  onPin={togglePinComment}
                  {...rowProps}
                />
                {expanded && replies.length > 0 && (
                  <ul className="mt-4 space-y-5">
                    {replies.map((reply) => (
                      <li key={reply.id}>
                        <ReplyRow
                          comment={reply}
                          {...rowProps}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
