'use client'

import React, { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Headphones, Send, Loader2, ArrowLeft, MessageCircle, Trash2, ImageIcon, Pencil, Check, X, CornerUpLeft } from 'lucide-react'
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
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: Message } | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
      .select('session_id, username, user_id, content, image_url, is_from_support, created_at')
      .order('created_at', { ascending: false })

    if (!data) return

    // Группируем по session_id
    const map = new Map<string, Session>()
    for (const msg of data) {
      if (!map.has(msg.session_id)) {
        map.set(msg.session_id, {
          session_id: msg.session_id,
          // Пока берём данные как есть, ниже перезапишем имя пользователя
          username: msg.is_from_support ? null : msg.username,
          user_id: msg.is_from_support ? null : msg.user_id,
          last_message: msg.content || (msg.image_url ? '📷 Изображение' : ''),
          last_at: msg.created_at,
          unread: !msg.is_from_support,
          last_seen: null,
          avatar: null,
        })
      } else {
        // Обновляем имя пользователя, если нашли сообщение от него
        const s = map.get(msg.session_id)!
        if (!msg.is_from_support && !s.username) {
          s.username = msg.username
          s.user_id = msg.user_id
        }
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
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_messages', filter: `session_id=eq.${activeSession}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, content: msg.content } : m))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'support_messages', filter: `session_id=eq.${activeSession}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id))
        }
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeSession])

  // Закрываем контекстное меню при клике вне его
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('click', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [contextMenu])

  async function handleReply() {
    if (!reply.trim() || !activeSession || sending || !token) return
    setSending(true)
    let content = reply.trim()
    if (replyTo) {
      const name = replyTo.is_from_support ? t('support.fromSupport') : (replyTo.username ?? t('support.guest'))
      const quote = replyTo.image_url ? '📷' : replyTo.content.slice(0, 150)
      content = `> ${name}: ${quote}\n\n${content}`
      setReplyTo(null)
    }
    await fetch('/api/support-reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ session_id: activeSession, content }),
    })
    setReply('')
    setSending(false)
  }

  function handleContextMenu(e: React.MouseEvent<HTMLDivElement>, msg: Message) {
    e.preventDefault()
    e.stopPropagation()
    const x = Math.min(e.clientX, window.innerWidth - 188)
    const y = Math.min(e.clientY, window.innerHeight - 160)
    setContextMenu({ x, y, msg })
  }

  function handleTouchStart(e: React.TouchEvent<HTMLDivElement>, msg: Message) {
    const touch = e.touches[0]
    const x = Math.min(touch.clientX, window.innerWidth - 188)
    const y = Math.min(touch.clientY, window.innerHeight - 160)
    longPressTimer.current = setTimeout(() => {
      setContextMenu({ x, y, msg })
    }, 500)
  }

  function handleTouchEnd() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  async function handleSaveEdit(id: string) {
    const trimmed = editContent.trim()
    if (!trimmed || !token) return
    setEditingMsgId(null)
    setEditContent('')
    await fetch('/api/support-reply', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ id, content: trimmed }),
    })
  }

  async function handleDeleteMsg() {
    if (!deleteMsgId || !token) return
    const id = deleteMsgId
    setDeleteMsgId(null)
    setMessages((prev) => prev.filter((m) => m.id !== id))
    await fetch('/api/support-reply', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ id }),
    })
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
                  {messages.map((msg) => {
                    const isReply = !msg.image_url && msg.content?.startsWith('> ')
                    const quoteLine = isReply ? msg.content.split('\n\n')[0].replace(/^> /, '') : null
                    const mainText = isReply ? msg.content.split('\n\n').slice(1).join('\n\n') : msg.content
                    return (
                      <div key={msg.id} className={`flex items-end gap-1.5 ${msg.is_from_support ? 'justify-end' : 'justify-start'}`}>
                        <div
                          onContextMenu={(e) => handleContextMenu(e as React.MouseEvent<HTMLDivElement>, msg)}
                          onTouchStart={(e) => handleTouchStart(e as React.TouchEvent<HTMLDivElement>, msg)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchEnd}
                          className={`max-w-[75%] cursor-default select-none rounded-2xl px-3 py-2 text-sm active:scale-[0.98] transition-transform ${
                            msg.is_from_support
                              ? 'rounded-br-sm bg-blue-600 text-white'
                              : 'rounded-tl-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/10'
                          }`}
                        >
                          {!msg.is_from_support && (
                            <p className="mb-0.5 text-[10px] text-slate-400 font-semibold">{msg.username ?? t('support.guest')}</p>
                          )}
                          {editingMsgId === msg.id ? (
                            <div className="flex flex-col gap-2 min-w-45">
                              <textarea
                                autoFocus
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(msg.id) }
                                  if (e.key === 'Escape') { setEditingMsgId(null); setEditContent('') }
                                }}
                                rows={2}
                                className={`w-full resize-none rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 ${
                                  msg.is_from_support
                                    ? 'bg-blue-700 text-white placeholder-blue-300 focus:ring-white/30'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:ring-slate-400/40'
                                }`}
                              />
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => { setEditingMsgId(null); setEditContent('') }}
                                  className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors ${
                                    msg.is_from_support
                                      ? 'hover:bg-white/10 text-blue-200 hover:text-white'
                                      : 'hover:bg-slate-200 dark:hover:bg-white/10 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                  }`}
                                  title={t('support.cancel')}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleSaveEdit(msg.id)}
                                  disabled={!editContent.trim()}
                                  className={`flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                                    msg.is_from_support
                                      ? 'bg-white/20 hover:bg-white/30 text-white'
                                      : 'bg-blue-500/20 hover:bg-blue-500/30 text-blue-500'
                                  }`}
                                  title={t('support.save')}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : msg.image_url ? (
                            <a href={msg.image_url} target="_blank" rel="noopener noreferrer">
                              <img src={msg.image_url} alt="изображение" className="rounded-lg max-w-full max-h-48 object-contain mt-0.5" />
                            </a>
                          ) : (
                            <>
                              {quoteLine && (
                                <div className={`mb-1.5 rounded-lg border-l-2 px-2 py-1 text-[11px] ${
                                  msg.is_from_support
                                    ? 'border-white/40 bg-white/10'
                                    : 'border-blue-400/60 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                                }`}>
                                  {quoteLine}
                                </div>
                              )}
                              <p className="leading-relaxed whitespace-pre-wrap wrap-break-word">{mainText}</p>
                            </>
                          )}
                          <p className={`mt-1 text-[10px] ${msg.is_from_support ? 'text-blue-200' : 'text-slate-400'}`}>
                            {formatTime(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </div>

                {/* Ввод ответа */}
                <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  {/* Превью ответа */}
                  {replyTo && (
                    <div className="flex items-start gap-2 border-b border-slate-100 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
                      <CornerUpLeft className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-blue-500">
                          {replyTo.is_from_support ? t('support.fromSupport') : (replyTo.username ?? t('support.guest'))}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                          {replyTo.image_url ? '📷 Изображение' : replyTo.content.slice(0, 100)}
                        </p>
                      </div>
                      <button
                        onClick={() => setReplyTo(null)}
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-600 transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-end gap-2 p-3">
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
                    ref={textareaRef}
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
                </div>
              </>
            )}
          </main>
        </div>
      </div>

      {/* ── Контекстное меню сообщения ── */}
      {contextMenu && (
        <div
          className="fixed z-[200]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-44 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-2xl overflow-hidden py-1">
            {/* Ответить */}
            <button
              onClick={() => {
                setReplyTo(contextMenu.msg)
                setContextMenu(null)
                setTimeout(() => textareaRef.current?.focus(), 50)
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <CornerUpLeft className="h-4 w-4 text-slate-400" />
              {t('support.reply')}
            </button>
            {/* Изменить — любое текстовое сообщение (не изображение) */}
            {!contextMenu.msg.image_url && (
              <button
                onClick={() => {
                  setEditingMsgId(contextMenu.msg.id)
                  setEditContent(contextMenu.msg.content)
                  setContextMenu(null)
                }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
              >
                <Pencil className="h-4 w-4 text-slate-400" />
                {t('support.editMessage')}
              </button>
            )}
            <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />
            {/* Удалить */}
            <button
              onClick={() => {
                setDeleteMsgId(contextMenu.msg.id)
                setContextMenu(null)
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
              {t('support.deleteMessage')}
            </button>
          </div>
        </div>
      )}

      {/* ── Модальное окно подтверждения удаления сообщения ── */}
      {deleteMsgId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDeleteMsgId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/10">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="text-center text-base font-semibold text-slate-900 dark:text-slate-100">
              {t('support.deleteMessage')}
            </h3>
            <p className="mt-2 text-center text-sm text-slate-500 dark:text-slate-400">
              {t('support.deleteMsgConfirm')}
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setDeleteMsgId(null)}
                className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50 dark:hover:bg-white/10"
              >
                {t('support.cancel')}
              </button>
              <button
                onClick={handleDeleteMsg}
                className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                {t('support.deleteMessage')}
              </button>
            </div>
          </div>
        </div>
      )}

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
