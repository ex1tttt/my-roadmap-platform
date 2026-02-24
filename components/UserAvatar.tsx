'use client'

import { useState } from 'react'

type UserAvatarProps = {
  username: string
  avatarUrl?: string | null
  size?: number // px, default 40
}

const GRADIENTS = [
  'from-blue-500 to-purple-500',
  'from-violet-500 to-pink-500',
  'from-cyan-500 to-blue-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-pink-500',
  'from-rose-500 to-purple-500',
]

// Детерминированный выбор градиента по имени — одно имя всегда даёт один цвет
function pickGradient(username: string) {
  const code = username.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return GRADIENTS[code % GRADIENTS.length]
}

export default function UserAvatar({ username, avatarUrl, size = 40 }: UserAvatarProps) {
  const [imgError, setImgError] = useState(false)
  const letter = username?.trim()?.[0]?.toUpperCase() ?? '?'
  const gradient = pickGradient(username ?? '')

  const fallback = (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-linear-to-br ${gradient} font-bold text-white select-none`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-label={username}
    >
      {letter}
    </span>
  )

  if (avatarUrl && !imgError) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ width: size, height: size }}
      >
        <img
          src={avatarUrl}
          alt={username}
          className="h-full w-full object-cover"
          onError={() => setImgError(true)}
        />
      </span>
    )
  }

  return fallback
}
