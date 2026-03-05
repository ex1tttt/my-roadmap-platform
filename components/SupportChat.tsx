'use client'

import React, { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Headphones, Loader2, ChevronDown, ImageIcon, CornerUpLeft, Pencil, Trash2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useTranslation } from 'react-i18next'

type Message = {
  id: string
  content: string
  image_url?: string | null
  is_from_support: boolean
  created_at: string
  username?: string | null
}

function getOrCreateSessionId(): string {
  const key = 'support_session_id'
  let id = localStorage.getItem(key)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(key, id)
  }
  return id
}

export default function SupportChat() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string } | null>(null)
  const [unread, setUnread] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msg: Message } | null>(null)
  const [replyTo, setReplyTo] = useState<Message | null>(null)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [deleteMsgId, setDeleteMsgId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Инициализация сессии и пользователя
  useEffect(() => {
    const sid = getOrCreateSessionId()
    setSessionId(sid)

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('id', user.id)
        .maybeSingle()
      if (data) setCurrentUser({ id: data.id, username: data.username })
    })
  }, [])

  // Загрузка истории при открытии
  useEffect(() => {
    if (!open || !sessionId) return
    setUnread(false)
    setLoading(true)
    supabase
      .from('support_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setMessages(data ?? [])
        setLoading(false)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
      })
  }, [open, sessionId])

  // Realtime подписка
  useEffect(() => {
    if (!sessionId) return
    const channel = supabase
      .channel(`support:${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_messages',
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (!open && msg.is_from_support) setUnread(true)
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'support_messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, content: msg.content } : m))
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'support_messages', filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setMessages((prev) => prev.filter((m) => m.id !== (payload.old as any).id))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, open])

  // Скролл вниз при открытии
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        inputRef.current?.focus()
      }, 100)
    }
  }, [open])

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

  async function handleSend() {
    if (!input.trim() || !sessionId || sending) return
    setSending(true)
    let text = input.trim()
    if (replyTo) {
      const name = replyTo.is_from_support ? t('support.fromSupport') : (replyTo.username ?? t('support.guest'))
      const quote = replyTo.image_url ? '\ud83d\udcf7' : replyTo.content.slice(0, 150)
      text = `> ${name}: ${quote}\n\n${text}`
      setReplyTo(null)
    }
    setInput('')

    await supabase.from('support_messages').insert({
      session_id: sessionId,
      user_id: currentUser?.id ?? null,
      username: currentUser?.username ?? null,
      content: text,
      is_from_support: false,
    })

    // Уведомляем админов
    fetch('/api/notify-support-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser?.id ?? null,
        username: currentUser?.username ?? null,
        session_id: sessionId,
      }),
    }).catch(() => {})

    setSending(false)
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !sessionId) return
    if (file.size > 5 * 1024 * 1024) {
      alert(t('support.fileTooLarge'))
      return
    }
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${sessionId}/${Date.now()}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('support-images')
      .upload(path, file, { upsert: false })
    if (upErr) {
      alert(t('support.uploadError') + upErr.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('support-images').getPublicUrl(path)
    await supabase.from('support_messages').insert({
      session_id: sessionId,
      user_id: currentUser?.id ?? null,
      username: currentUser?.username ?? null,
      content: '',
      image_url: urlData.publicUrl,
      is_from_support: false,
    })

    // Уведомляем админов
    fetch('/api/notify-support-admins', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: currentUser?.id ?? null,
        username: currentUser?.username ?? null,
        session_id: sessionId,
      }),
    }).catch(() => {})

    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
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
    if (!trimmed) return
    setEditingMsgId(null)
    setEditContent('')
    await supabase.from('support_messages').update({ content: trimmed }).eq('id', id)
  }

  async function handleDeleteMsg() {
    if (!deleteMsgId) return
    const id = deleteMsgId
    setDeleteMsgId(null)
    setMessages((prev) => prev.filter((m) => m.id !== id))
    await supabase.from('support_messages').delete().eq('id', id)
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <>
      {/* ── Чат-панель ── */}
      {open && (
        <div className="fixed bottom-20 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden sm:right-6">
          {/* Шапка */}
          <div className="flex items-center gap-3 bg-blue-600 px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
              <Headphones className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">{t('support.title')}</p>
              <p className="text-xs text-blue-100">{t('support.subtitle')}</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          </div>

          {/* Сообщения */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-80 min-h-50 bg-slate-50 dark:bg-slate-950/50">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Headphones className="mb-2 h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{t('support.emptyTitle')}</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{t('support.emptyDesc')}</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isReply = !msg.image_url && msg.content?.startsWith('> ')
                const quoteLine = isReply ? msg.content.split('\n\n')[0].replace(/^> /, '') : null
                const mainText = isReply ? msg.content.split('\n\n').slice(1).join('\n\n') : msg.content
                return (
                  <div
                    key={msg.id}
                    className={`flex ${msg.is_from_support ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      onContextMenu={(e) => handleContextMenu(e as React.MouseEvent<HTMLDivElement>, msg)}
                      onTouchStart={(e) => handleTouchStart(e as React.TouchEvent<HTMLDivElement>, msg)}
                      onTouchEnd={handleTouchEnd}
                      onTouchMove={handleTouchEnd}
                      className={`max-w-[80%] cursor-default select-none rounded-2xl px-3 py-2 text-sm active:scale-[0.98] transition-transform ${
                        msg.is_from_support
                          ? 'rounded-tl-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-white/10'
                          : 'rounded-tr-sm bg-blue-600 text-white'
                      }`}
                    >
                      {msg.is_from_support && (
                        <p className="mb-0.5 text-[10px] font-semibold text-blue-500">{t('support.fromSupport')}</p>
                      )}
                      {editingMsgId === msg.id ? (
                        <div className="flex flex-col gap-2 min-w-40">
                          <textarea
                            autoFocus
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveEdit(msg.id) }
                              if (e.key === 'Escape') { setEditingMsgId(null); setEditContent('') }
                            }}
                            rows={2}
                            className="w-full resize-none rounded-lg bg-blue-700 text-white placeholder-blue-300 px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
                          />
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => { setEditingMsgId(null); setEditContent('') }}
                              className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-white/10 text-blue-200 hover:text-white transition-colors"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleSaveEdit(msg.id)}
                              disabled={!editContent.trim()}
                              className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors disabled:opacity-40"
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
                                ? 'border-blue-400/60 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'
                                : 'border-white/40 bg-white/10'
                            }`}>
                              {quoteLine}
                            </div>
                          )}
                          <p className="leading-relaxed whitespace-pre-wrap wrap-break-word">{mainText}</p>
                        </>
                      )}
                      <p className={`mt-1 text-[10px] ${msg.is_from_support ? 'text-slate-400' : 'text-blue-200'}`}>
                        {formatTime(msg.created_at)}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Ввод */}
          <div className="border-t border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
            {/* Превью ответа */}
            {replyTo && (
              <div className="flex items-start gap-2 border-b border-slate-100 dark:border-slate-800 px-3 py-2 bg-slate-50 dark:bg-slate-800/50">
                <CornerUpLeft className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-blue-500">
                    {replyTo.is_from_support ? t('support.fromSupport') : (replyTo.username ?? t('support.guest'))}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {replyTo.image_url ? '📷 Изображение' : replyTo.content.slice(0, 80)}
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
              disabled={uploading || sending}
              title={t('support.sendImage')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-500 hover:border-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('support.placeholder')}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 max-h-24"
              style={{ fieldSizing: 'content' } as any}
            />
            <button
              onClick={handleSend}
              disabled={sending || !input.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition-all hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Контекстное меню ── */}
      {contextMenu && (
        <div
          className="fixed z-[300]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="min-w-44 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-2xl overflow-hidden py-1">
            {/* Ответить */}
            <button
              onClick={() => {
                setReplyTo(contextMenu.msg)
                setContextMenu(null)
                setTimeout(() => inputRef.current?.focus(), 50)
              }}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
            >
              <CornerUpLeft className="h-4 w-4 text-slate-400" />
              {t('support.reply')}
            </button>
            {/* Изменить — только свои сообщения (не от поддержки) */}
            {!contextMenu.msg.is_from_support && !contextMenu.msg.image_url && (
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
            {!contextMenu.msg.is_from_support && (
              <>
                <div className="my-1 h-px bg-slate-100 dark:bg-white/5" />
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
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Подтверждение удаления ── */}
      {deleteMsgId && (
        <div
          className="fixed inset-0 z-[400] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDeleteMsgId(null)}
        >
          <div
            className="w-full max-w-xs rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 shadow-2xl p-6"
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

      {/* ── Плавающая кнопка ── */}
      <button
        onClick={() => { setOpen((v) => !v); setUnread(false) }}
        className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-500 hover:scale-105 active:scale-95 sm:right-6"
        aria-label={t('support.title')}
      >
        {open ? (
          <X className="h-5 w-5" />
        ) : (
          <>
            <MessageCircle className="h-5 w-5" />
            {unread && (
              <span className="absolute right-0 top-0 flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
              </span>
            )}
          </>
        )}
      </button>
    </>
  )
}
