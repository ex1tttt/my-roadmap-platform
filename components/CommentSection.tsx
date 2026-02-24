'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Trash2, MessageSquare, Send, User, CornerDownRight, Heart } from 'lucide-react'

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  parent_id: string | null
  parentAuthorName?: string
  parentAuthorUserId?: string
  author: {
    username: string
    avatar?: string
  }
  likesCount: number
  isLiked: boolean
  replies?: Comment[]
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Рекурсивно обновляет лайк в дереве (без мутации) */
function updateTree(
  nodes: Comment[],
  commentId: string,
  isLiked: boolean,
  delta: number,
): Comment[] {
  return nodes.map((c) => {
    if (c.id === commentId) {
      return { ...c, isLiked, likesCount: Math.max(0, c.likesCount + delta) }
    }
    if (c.replies?.length) {
      return { ...c, replies: updateTree(c.replies, commentId, isLiked, delta) }
    }
    return c
  })
}

/** Строим дерево из плоского массива */
function buildTree(flat: Comment[]): Comment[] {
  const map = new Map<string, Comment>()
  flat.forEach((c) => map.set(c.id, { ...c, replies: [] }))

  const roots: Comment[] = []
  map.forEach((c) => {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies!.push(c)
    } else {
      roots.push(c)
    }
  })
  return roots
}

/* ─── Один комментарий (рекурсивный) ─────────────────────────────── */
function CommentItem({
  comment,
  currentUserId,
  deletingId,
  replyingTo,
  replyText,
  replySending,
  depth,
  onDelete,
  onReplyClick,
  onReplyTextChange,
  onReplySubmit,
  onReplyCancel,  onLike,}: {
  comment: Comment
  currentUserId: string | null
  deletingId: string | null
  replyingTo: string | null
  replyText: string
  replySending: boolean
  depth: number
  onDelete: (id: string) => void
  onReplyClick: (id: string) => void
  onReplyTextChange: (t: string) => void
  onReplySubmit: (parentId: string) => void
  onReplyCancel: () => void
  onLike: (id: string, wasLiked: boolean) => void
}) {
  const isReplying = replyingTo === comment.id
  // ml-6 за каждый уровень, максимум 3 уровня вложенности
  const marginLeft = Math.min(depth, 3) * 24 // px

  return (
    <li
      style={marginLeft > 0 ? { marginLeft: `${marginLeft}px` } : undefined}
      className={depth > 0 ? 'ml-2 border-l-2 border-slate-700 pl-4' : ''}
    >
      <div className="group rounded-xl border border-white/10 bg-slate-800/50 p-4 backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-slate-800/70">
        {/* Шапка */}
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/profile/${comment.user_id}`}
            className="flex items-center gap-2.5 group/author"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700 transition-opacity group-hover/author:opacity-80">
              {comment.author.avatar ? (
                <img src={comment.author.avatar} alt={comment.author.username} className="h-full w-full object-cover" />
              ) : (
                <User className="h-3.5 w-3.5 text-slate-400" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-200 underline-offset-2 transition-colors group-hover/author:text-blue-400 group-hover/author:underline">
                {comment.author.username}
              </p>
              <p className="text-xs text-slate-500">{formatDate(comment.created_at)}</p>
            </div>
          </Link>

          {comment.user_id === currentUserId && (
            <button
              onClick={() => onDelete(comment.id)}
              disabled={deletingId === comment.id}
              title="Удалить"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Текст: перед содержимым — @упоминание синим */}
        <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
          {comment.parent_id && comment.parentAuthorName && (
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

        {/* Футер: лайк + ответить */}
        <div className="mt-2.5 flex items-center justify-between">
          <button
            onClick={() => onLike(comment.id, comment.isLiked)}
            disabled={!currentUserId}
            title={comment.isLiked ? 'Убрать лайк' : 'Понравилось'}
            className={`flex items-center gap-1.5 text-xs transition-all disabled:cursor-default ${
              comment.isLiked
                ? 'text-rose-400'
                : 'text-slate-500 hover:text-rose-400 disabled:opacity-40'
            }`}
          >
            <Heart
              className={`h-3.5 w-3.5 transition-all duration-200 ${
                comment.isLiked ? 'scale-110 fill-rose-400' : ''
              }`}
            />
            {comment.likesCount > 0 && <span>{comment.likesCount}</span>}
          </button>

          {currentUserId && (
            <button
              onClick={() => onReplyClick(comment.id)}
              className="flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-blue-400"
            >
              <CornerDownRight className="h-3 w-3" />
              Ответить
            </button>
          )}
        </div>

        {/* Поле ответа */}
        {isReplying && (
          <div className="mt-3 rounded-lg border border-blue-500/30 bg-slate-900/60 p-3">
            <textarea
              autoFocus
              value={replyText}
              onChange={(e) => onReplyTextChange(e.target.value)}
              placeholder="Ваш ответ..."
              rows={2}
              className="w-full resize-none bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2 border-t border-white/5 pt-2">
              <button
                onClick={onReplyCancel}
                className="px-3 py-1 text-xs text-slate-400 transition-colors hover:text-slate-200"
              >
                Отмена
              </button>
              <button
                disabled={!replyText.trim() || replySending}
                onClick={() => onReplySubmit(comment.id)}
                className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Send className="h-3 w-3" />
                {replySending ? 'Отправка...' : 'Ответить'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Рекурсивные ответы */}
      {comment.replies && comment.replies.length > 0 && (
        <ul className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              deletingId={deletingId}
              replyingTo={replyingTo}
              replyText={replyText}
              replySending={replySending}
              depth={depth + 1}
              onDelete={onDelete}
              onReplyClick={onReplyClick}
              onReplyTextChange={onReplyTextChange}
              onReplySubmit={onReplySubmit}
              onReplyCancel={onReplyCancel}
              onLike={onLike}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

/* ─── Основной компонент ────────────────────────────────────────── */
export default function CommentSection({ roadmapId }: { roadmapId: string }) {
  const [tree, setTree] = useState<Comment[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, parent_id, profiles:user_id(username, avatar), parentComment:parent_id(user_id, profiles:user_id(username))')
      .eq('roadmap_id', roadmapId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Ошибка загрузки комментариев:', error)
      setLoading(false)
      return
    }

    const ids = (data ?? []).map((c: any) => c.id as string)

    // Загружаем лайки параллельно: общее количество + лайки текущего пользователя
    const [{ data: allLikes }, { data: myLikes }] = await Promise.all([
      ids.length
        ? supabase.from('comment_likes').select('comment_id').in('comment_id', ids)
        : Promise.resolve({ data: [] as any[] }),
      ids.length && currentUserId
        ? supabase
            .from('comment_likes')
            .select('comment_id')
            .in('comment_id', ids)
            .eq('user_id', currentUserId)
        : Promise.resolve({ data: [] as any[] }),
    ])

    const countMap = new Map<string, number>()
    ;(allLikes ?? []).forEach((l: any) => {
      countMap.set(l.comment_id, (countMap.get(l.comment_id) ?? 0) + 1)
    })
    const likedSet = new Set<string>((myLikes ?? []).map((l: any) => l.comment_id as string))

    const flat: Comment[] = (data ?? []).map((c: any) => {
      const pc = c.parentComment
      const pcProfiles = pc ? (Array.isArray(pc.profiles) ? pc.profiles[0] : pc.profiles) : null
      return {
        id: c.id,
        content: c.content,
        created_at: c.created_at,
        user_id: c.user_id,
        parent_id: c.parent_id ?? null,
        parentAuthorName: pcProfiles?.username ?? undefined,
        parentAuthorUserId: pc?.user_id ?? undefined,
        author: Array.isArray(c.profiles)
          ? (c.profiles[0] ?? { username: 'Unknown' })
          : (c.profiles ?? { username: 'Unknown' }),
        likesCount: countMap.get(c.id) ?? 0,
        isLiked: likedSet.has(c.id),
      }
    })

    setTotalCount(flat.length)
    setTree(buildTree(flat))
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

    setSending(true)
    const { error } = await supabase.from('comments').insert({
      roadmap_id: roadmapId,
      user_id: currentUserId,
      content: trimmed,
    })
    if (error) {
      console.error(error)
    } else {
      setText('')
      await fetchComments()
      textareaRef.current?.focus()
    }
    setSending(false)
  }

  async function handleReplySubmit(parentId: string) {
    const trimmed = replyText.trim()
    if (!trimmed || !currentUserId || replySending) return

    setReplySending(true)
    const { error } = await supabase.from('comments').insert({
      roadmap_id: roadmapId,
      user_id: currentUserId,
      content: trimmed,
      parent_id: parentId,
    })
    if (error) {
      console.error(error)
    } else {
      setReplyText('')
      setReplyingTo(null)
      await fetchComments()
    }
    setReplySending(false)
  }

  async function handleLike(commentId: string, wasLiked: boolean) {
    if (!currentUserId) return
    // Оптимистичное обновление UI
    setTree((prev) => updateTree(prev, commentId, !wasLiked, wasLiked ? -1 : 1))
    if (wasLiked) {
      await supabase
        .from('comment_likes')
        .delete()
        .eq('comment_id', commentId)
        .eq('user_id', currentUserId)
    } else {
      await supabase
        .from('comment_likes')
        .upsert({ comment_id: commentId, user_id: currentUserId })
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

  return (
    <section className="mt-12">
      <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-200">
        <MessageSquare className="h-5 w-5 text-blue-400" />
        Комментарии
        {!loading && (
          <span className="ml-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
            {totalCount}
          </span>
        )}
      </h2>

      {/* Форма верхнего уровня */}
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="rounded-xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-sm transition-colors focus-within:border-blue-500/40">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={currentUserId ? 'Напишите комментарий...' : 'Войдите, чтобы оставить комментарий'}
            disabled={!currentUserId || sending}
            rows={3}
            className="w-full resize-none bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="mt-3 flex justify-end border-t border-white/5 pt-3">
            <button
              type="submit"
              disabled={!currentUserId || !text.trim() || sending}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      </form>

      {/* Дерево комментариев */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-slate-800/40 p-4">
              <div className="flex items-center gap-3">
                <div className="h-7 w-7 rounded-full bg-slate-700" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-slate-700" />
                  <div className="h-2.5 w-16 rounded bg-slate-700" />
                </div>
              </div>
              <div className="mt-3 h-3 w-3/4 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-slate-900/30 p-8 text-center text-slate-500">
          Комментариев пока нет. Будьте первым!
        </div>
      ) : (
        <ul className="space-y-3">
          {tree.map((c) => (
            <CommentItem
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              deletingId={deletingId}
              replyingTo={replyingTo}
              replyText={replyText}
              replySending={replySending}
              depth={0}
              onDelete={handleDelete}
              onReplyClick={handleReplyClick}
              onReplyTextChange={setReplyText}
              onReplySubmit={handleReplySubmit}
              onReplyCancel={() => { setReplyingTo(null); setReplyText('') }}
              onLike={handleLike}
            />
          ))}
        </ul>
      )}
    </section>
  )
}
