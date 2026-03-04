'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Headphones, Send, Loader2, ArrowLeft, User, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import UserAvatar from '@/components/UserAvatar'

const ADMIN_USER_ID = process.env.NEXT_PUBLIC_ADMIN_USER_ID

type Message = {
  id: string
  session_id: string
  content: string
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
}

export default function AdminSupportPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Проверка прав администратора
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || session.user.id !== ADMIN_USER_ID) {
        setAuthorized(false)
        router.replace('/')
        return
      }
      setAuthorized(true)
      setToken(session.access_token)
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
        })
      }
    }
    setSessions(Array.from(map.values()))
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

  function handleSelectSession(sid: string) {
    setActiveSession(sid)
    loadMessages(sid)
    setSessions((prev) =>
      prev.map((s) => s.session_id === sid ? { ...s, unread: false } : s)
    )
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
            На главную
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <Headphones className="h-4 w-4 text-white" />
            </div>
            <h1 className="text-lg font-bold">Панель поддержки</h1>
          </div>
        </div>

        <div className="flex gap-4 h-[calc(100vh-160px)]">
          {/* Список сессий */}
          <aside className={`${activeSession ? 'hidden sm:flex' : 'flex'} w-full sm:w-72 shrink-0 flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden`}>
            <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Обращения</h2>
              <p className="text-xs text-slate-400">{sessions.length} диалог{sessions.length === 1 ? '' : 'ов'}</p>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <MessageCircle className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="text-sm text-slate-400">Нет обращений</p>
                </div>
              ) : sessions.map((s) => (
                <button
                  key={s.session_id}
                  onClick={() => handleSelectSession(s.session_id)}
                  className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/5 ${
                    activeSession === s.session_id ? 'bg-blue-50 dark:bg-blue-500/10' : ''
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    <UserAvatar username={s.username ?? 'Гость'} size={32} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                        {s.username ?? 'Гость'}
                      </span>
                      {s.unread && (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400">{s.last_message}</p>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-0.5">{formatTime(s.last_at)}</p>
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Область диалога */}
          <main className={`${activeSession ? 'flex' : 'hidden sm:flex'} flex-1 flex-col rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 overflow-hidden`}>
            {!activeSession ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <MessageCircle className="h-10 w-10 text-slate-200 dark:text-slate-700" />
                <p className="text-sm text-slate-400">Выберите обращение</p>
              </div>
            ) : (
              <>
                {/* Шапка диалога */}
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
                  <button
                    onClick={() => setActiveSession(null)}
                    className="flex sm:hidden items-center gap-1 text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <UserAvatar username={messages[0]?.username ?? 'Гость'} size={28} />
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                      {messages.find((m) => !m.is_from_support)?.username ?? 'Гость'}
                    </p>
                    <p className="text-xs text-slate-400 font-mono">
                      {activeSession.slice(0, 8)}...
                    </p>
                  </div>
                </div>

                {/* Сообщения */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 dark:bg-slate-950/30">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.is_from_support ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                        msg.is_from_support
                          ? 'rounded-tl-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/10'
                          : 'rounded-tr-sm bg-blue-600 text-white'
                      }`}>
                        {!msg.is_from_support && (
                          <p className="mb-0.5 text-[10px] text-blue-200 font-semibold flex items-center gap-1">
                            <User className="h-2.5 w-2.5" /> {msg.username ?? 'Гость'}
                          </p>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap wrap-break-word">{msg.content}</p>
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
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                    placeholder="Написать ответ..."
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
    </div>
  )
}
