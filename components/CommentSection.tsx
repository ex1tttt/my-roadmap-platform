'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trash2, MessageSquare, Send, User } from 'lucide-react'

type Comment = {
  id: string
  content: string
  created_at: string
  user_id: string
  author: {
    username: string
    avatar?: string
  }
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

export default function CommentSection({ roadmapId }: { roadmapId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Загружаем текущего пользователя
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id ?? null)
    })
  }, [])

  // Загружаем комментарии с профилями авторов
  async function fetchComments() {
    const { data, error } = await supabase
      .from('comments')
      .select('id, content, created_at, user_id, profiles:user_id(username, avatar)')
      .eq('roadmap_id', roadmapId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Ошибка загрузки комментариев:', error)
      setLoading(false)
      return
    }

    const mapped: Comment[] = (data ?? []).map((c: any) => ({
      id: c.id,
      content: c.content,
      created_at: c.created_at,
      user_id: c.user_id,
      author: Array.isArray(c.profiles)
        ? (c.profiles[0] ?? { username: 'Unknown' })
        : (c.profiles ?? { username: 'Unknown' }),
    }))

    setComments(mapped)
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
      console.error('Ошибка отправки комментария:', error)
    } else {
      setText('')
      await fetchComments()
      textareaRef.current?.focus()
    }
    setSending(false)
  }

  async function handleDelete(commentId: string) {
    if (deletingId) return
    setDeletingId(commentId)
    const { error } = await supabase.from('comments').delete().eq('id', commentId)
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    }
    setDeletingId(null)
  }

  const canSubmit = !!currentUserId && text.trim().length > 0 && !sending

  return (
    <section className="mt-12">
      {/* Заголовок */}
      <h2 className="mb-6 flex items-center gap-2 text-lg font-semibold text-slate-200">
        <MessageSquare className="h-5 w-5 text-blue-400" />
        Комментарии
        {!loading && (
          <span className="ml-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-400">
            {comments.length}
          </span>
        )}
      </h2>

      {/* Форма отправки */}
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
              disabled={!canSubmit}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
              {sending ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </div>
      </form>

      {/* Список комментариев */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse rounded-xl border border-white/5 bg-slate-800/40 p-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-700" />
                <div className="space-y-1.5">
                  <div className="h-3 w-24 rounded bg-slate-700" />
                  <div className="h-2.5 w-16 rounded bg-slate-700" />
                </div>
              </div>
              <div className="mt-3 h-3 w-3/4 rounded bg-slate-700" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="rounded-xl border border-white/5 bg-slate-900/30 p-8 text-center text-slate-500">
          Комментариев пока нет. Будьте первым!
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="group rounded-xl border border-white/10 bg-slate-800/50 p-4 backdrop-blur-sm transition-colors hover:border-white/15 hover:bg-slate-800/70"
            >
              {/* Шапка комментария */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Аватар */}
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-700">
                    {c.author.avatar ? (
                      <img
                        src={c.author.avatar}
                        alt={c.author.username}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <User className="h-4 w-4 text-slate-400" />
                    )}
                  </div>

                  {/* Имя + дата */}
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{c.author.username}</p>
                    <p className="text-xs text-slate-500">{formatDate(c.created_at)}</p>
                  </div>
                </div>

                {/* Кнопка удаления — только для своих комментариев */}
                {c.user_id === currentUserId && (
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={deletingId === c.id}
                    title="Удалить комментарий"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-600 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Текст */}
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {c.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
