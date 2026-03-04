'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Headphones, Send, Loader2, ArrowLeft, MessageCircle, Trash2, ImageIcon } from 'lucide-react'
import Link from 'next/link'
import UserAvatar from '@/components/UserAvatar'
import { useTranslation } from 'react-i18next'

const ADMIN_IDS = [
  'a48b5f93-2e98-48c8-98f1-860ca962f651', // tkachmaksim2007
  'b63af445-e18d-4e5b-a0e1-ba747f2b4948', // atrybut2006
]

type Message = {
  id: string
  session_id: string
  content: string
  image_url?: string | null
  is_from_support: boolean
  created_at: string
  username?: string | null
  user_id?: string | null
}

type Session = {
  session_id: string
  username: string | null
  user_id: string | null
  last_message: string
  last_at: string
  unread: boolean
  last_seen: string | null
  avatar: string | null
}

export default function AdminSupportPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [adminId, setAdminId] = useState<string | null>(null)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Проверка прав администратора
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || !ADMIN_IDS.includes(session.user.id)) {
        setAuthorized(false)
        router.replace('/')
        return
      }
      setAuthorized(true)
      setToken(session.access_token)
      setAdminId(session.user.id)
      loadSessions()
    })
  }, [])

  async function loadSessions() {
    const { data } = await supabase
      .from('support_messages')
      .select('session_id, username, user_id, content, is_from_support, created_at')
      .order('created_at', { ascending: false })

    if (!data) return

    // Группируем по session_id
    const map = new Map<string, Session>()
    for (const msg of data) {
      if (!map.has(msg.session_id)) {
        map.set(msg.session_id, {
          session_id: msg.session_id,
          username: msg.username,
          user_id: msg.user_id,
          last_message: msg.content,
          last_at: msg.created_at,
          unread: !msg.is_from_support,
          last_seen: null,
          avatar: null,
        })
      }
    }
    const list = Array.from(map.values())

    // Подгружаем last_seen из profiles
    const userIds = list.map((s) => s.user_id).filter(Boolean) as string[]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, last_seen, avatar')
        .in('id', userIds)
      if (profiles) {
        const profileMap = new Map(profiles.map((p) => [p.id, p]))
        list.forEach((s) => {
          if (s.user_id) {
            const p = profileMap.get(s.user_id)
            s.last_seen = p?.last_seen ?? null
            s.avatar = p?.avatar ?? null
          }
        })
      }
    }
    setSessions(list)
  }

  async function loadMessages(sessionId: string) {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
    setMessages(data ?? [])
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  // Realtime для активной сессии
  useEffect(() => {
    if (!activeSession) return
    const channel = supabase
      .channel(`admin-support:${activeSession}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `session_id=eq.${activeSession}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => prev.some((m) => m.id === msg.id) ? prev : [...prev, msg])
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeSession])

  async function handleReply() {
    if (!reply.trim() || !activeSession || sending || !token) return
    setSending(true)
    await fetch('/api/support-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: activeSession, content: reply.trim() }),
    })
    setReply('')
    setSending(false)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeSession || !token) return
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 5 МБ.')
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${activeSession}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('support-images')
      .upload(path, file, { upsert: false })
    if (upErr) {
      alert(t('support.uploadError') + upErr.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('support-images').getPublicUrl(path)
    await fetch('/api/support-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: activeSession, content: '', image_url: urlData.publicUrl }),
    })
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Обновляем присутствие админа в сессии
  useEffect(() => {
    if (!adminId) return

    async function upsertPresence() {
      if (!activeSession) {
        // Нет активной сессии — удаляем запись
        await supabase.from('admin_presence').delete().eq('admin_id', adminId)
      } else {
        await supabase.from('admin_presence').upsert(
          { admin_id: adminId, session_id: activeSession, updated_at: new Date().toISOString() },
          { onConflict: 'admin_id' }
        )
      }
    }
    upsertPresence()

    // При закрытии вкладки — очищаем присутствие
    return () => {
      supabase.from('admin_presence').delete().eq('admin_id', adminId).then(() => {})
    }
  }, [activeSession, adminId])

  function handleSelectSession(sid: string) {
    setActiveSession(sid)
    loadMessages(sid)
    setSessions((prev) =>
      prev.map((s) => s.session_id === sid ? { ...s, unread: false } : s)
    )
  }

  async function handleDeleteSession(sid: string) {
    setDeleteTargetId(sid)
  }

  async function confirmDelete() {
    if (!deleteTargetId) return
    const sid = deleteTargetId
    setDeleteTargetId(null)
    await supabase.from('support_messages').delete().eq('session_id', sid)
    setSessions((prev) => prev.filter((s) => s.session_id !== sid))
    if (activeSession === sid) {
      setActiveSession(null)
      setMessages([])
    }
  }

  function lastSeenText(iso: string | null): string {
    if (!iso) return t('support.lastSeenUnknown')
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return t('support.justNow')
    if (diff < 3600) return `${Math.floor(diff / 60)} ${t('support.minutesAgo')}`
    if (diff < 86400) return `${Math.floor(diff / 3600)} ${t('support.hoursAgo')}`
    return `${Math.floor(diff / 86400)} ${t('support.daysAgo')}`
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  }

  if (authorized === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#020617]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    )
  }

  if (authorized === false) return null

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Шапка */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-white/5 px-3 py-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {t('support.backToHome')}
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Headphones className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold">{t('support.adminTitle')}</h1>
          </div>
        </div>

        <div className="flex gap-4 h-[calc(100vh-160px)]">
          {/* Список сессий */}
          <aside className={`${activeSession ? 'hidden sm:flex' : 'flex'} w-full sm:w-72 shrink-0 flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden`}>
            <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">{t('support.sessions')}</h2>
              <p className="text-xs text-slate-400">{sessions.length} {t('support.dialogs_many')}</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageCircle className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-400">{t('support.noSessions')}</p>
                </div>
              ) : sessions.map((s) => (
                <div key={s.session_id} className={`group relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${activeSession === s.session_id ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}
                  onClick={() => handleSelectSession(s.session_id)}
                >
                  <div className="mt-0.5 shrink-0">
                    <UserAvatar username={s.username ?? 'Гость'} avatarUrl={s.avatar} size={32} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {s.username ?? t('support.guest')}
                      </span>
                      {s.unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400">{s.last_message}</p>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">
                      {t('support.lastSeen')} {lastSeenText(s.last_seen)}
                    </p>
                  </div>
                  {/* Кнопка удаления */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.session_id) }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
                    title="Удалить чат"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </aside>

          {/* Область диалога */}
          <main className={`${activeSession ? 'flex' : 'hidden sm:flex'} flex-1 flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden`}>
            {!activeSession ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <MessageCircle className="h-10 w-10 text-slate-200 dark:text-slate-700" />
                <p className="text-sm text-slate-400">{t('support.selectSession')}</p>
              </div>
            ) : (
              <>
                {/* Шапка диалога */}
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                  <button
                    onClick={() => {
                      setActiveSession(null)
                      // presence также очистится через useEffect
                    }}
                    className="flex sm:hidden items-center gap-1 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <UserAvatar username={messages.find((m) => !m.is_from_support)?.username ?? t('support.guest')} avatarUrl={sessions.find((s) => s.session_id === activeSession)?.avatar ?? null} size={28} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {messages.find((m) => !m.is_from_support)?.username ?? t('support.guest')}
                    </p>
                    <p className="text-xs text-slate-400">
                      {t('support.lastSeen')} {lastSeenText(sessions.find((s) => s.session_id === activeSession)?.last_seen ?? null)}
                    </p>
                  </div>
                  {/* Кнопка удаления чата */}
                  <button
                    onClick={() => handleDeleteSession(activeSession!)}
                    className="ml-auto flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 hover:border-red-500/50"
                    title={t('support.deleteChat')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('support.deleteChat')}
                  </button>
                </div>

                {/* Сообщения */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950/30">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex items-end gap-2 ${msg.is_from_support ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                        msg.is_from_support
                          ? 'rounded-tl-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/10'
                          : 'rounded-br-sm bg-blue-600 text-white'
                      }`}>
                    {!msg.is_from_support && (
                          <p className="mb-0.5 text-[10px] text-blue-200 font-semibold">{msg.username ?? t('support.guest')}</p>
                        )}
                        {msg.image_url ? (
                          <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                            <img src={msg.image_url} alt="изображение" className="rounded-lg max-w-full max-h-48 object-contain mt-0.5" />
                          </a>
                        ) : (
                          <p className="leading-relaxed whitespace-pre-wrap wrap-break-word">{msg.content}</p>
                        )}
                        <p className={`mt-1 text-[10px] ${msg.is_from_support ? 'text-slate-400' : 'text-blue-200'}`}>
                          {formatTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>

                {/* Ввод ответа */}
                <div className="flex items-end gap-2 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading || sending || !activeSession}
                    title={t('support.sendImage')}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                  </button>
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                    placeholder={t('support.replyPlaceholder')}
                    rows={1}
                    className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-h-28"
                    style={{ fieldSizing: 'content' } as any}
                  />
                  <button
                    onClick={handleReply}
                    disabled={sending || !reply.trim()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* ── Модальное окно подтверждения удаления ── */}
      {deleteTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDeleteTargetId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Иконка */}
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>

            {/* Заголовок */}
            <h3 className="text-center text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('support.deleteChat')}
            </h3>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('support.deleteConfirm')}
            </p>

            {/* Кнопки */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-white/10"
              >
                {t('support.cancel')}
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                {t('support.deleteChat')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
