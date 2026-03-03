'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ShieldBan, ShieldCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

interface Props {
  targetUserId: string
  currentUserId: string
  initialIsBlocked: boolean
  onBlock?: () => void   // вызывается после успешной блокировки
  onUnblock?: () => void // вызывается после снятия блокировки
}

export default function BlockButton({
  targetUserId,
  currentUserId,
  initialIsBlocked,
  onBlock,
  onUnblock,
}: Props) {
  const { t } = useTranslation()
  const [isBlocked, setIsBlocked] = useState(initialIsBlocked)
  const [loading, setLoading] = useState(false)

  async function handleBlock() {
    if (loading) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_blocks')
        .insert({ blocker_id: currentUserId, blocked_id: targetUserId })
      if (error) throw error
      setIsBlocked(true)
      toast.success(t('block.blocked'))
      onBlock?.()
    } catch (err: any) {
      toast.error(t('common.error') + ': ' + (err?.message ?? ''))
    } finally {
      setLoading(false)
    }
  }

  async function handleUnblock() {
    if (loading) return
    setLoading(true)
    try {
      const { error } = await supabase
        .from('user_blocks')
        .delete()
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', targetUserId)
      if (error) throw error
      setIsBlocked(false)
      toast.success(t('block.unblocked'))
      onUnblock?.()
    } catch (err: any) {
      toast.error(t('common.error') + ': ' + (err?.message ?? ''))
    } finally {
      setLoading(false)
    }
  }

  function confirmBlock() {
    const tId = toast(
      <div style={{ textAlign: 'center' }} className="flex flex-col items-center gap-3 bg-slate-900 rounded-xl p-4 w-full">
        <span className="text-white text-sm block w-full" style={{ textAlign: 'center' }}>
          {t('block.confirmBlock')}
        </span>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 text-xs rounded bg-red-600 text-white hover:bg-red-700 transition"
            onClick={() => { toast.dismiss(tId); handleBlock() }}
          >{t('block.blockAction')}</button>
          <button
            className="px-3 py-1 text-xs rounded bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            onClick={() => toast.dismiss(tId)}
          >{t('common.cancel')}</button>
        </div>
      </div>,
      { duration: 10000, position: 'top-center', closeButton: false }
    )
  }

  if (isBlocked) {
    return (
      <button
        onClick={handleUnblock}
        disabled={loading}
        title={t('block.unblockHint')}
        className="flex items-center gap-1.5 rounded-lg border border-green-500/40 bg-green-950/30 px-3 py-1.5 text-sm font-medium text-green-400 transition-all hover:bg-green-900/40 disabled:opacity-50"
      >
        <ShieldCheck className="h-4 w-4" />
        {t('block.unblock')}
      </button>
    )
  }

  return (
    <button
      onClick={confirmBlock}
      disabled={loading}
      title={t('block.blockHint')}
      className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-3 py-1.5 text-sm font-medium text-slate-500 dark:text-slate-400 transition-all hover:border-red-500/40 hover:bg-red-950/30 hover:text-red-400 disabled:opacity-50"
    >
      <ShieldBan className="h-4 w-4" />
      {t('block.block')}
    </button>
  )
}
