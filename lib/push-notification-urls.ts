const CTRL = /[\u0000-\u001F\u007F]/
const MAX_LEN = 2048

function addHostname(set: Set<string>, raw: string | undefined) {
  if (!raw) return
  try {
    const u = new URL(raw.includes('://') ? raw : `https://${raw}`)
    set.add(u.hostname.toLowerCase())
  } catch {
    /* ignore */
  }
}

/** Hostnames allowed for https:// icons (avatars, storage). */
export function getPushImageAllowedHosts(): Set<string> {
  const set = new Set<string>()
  addHostname(set, process.env.NEXT_PUBLIC_SUPABASE_URL)
  addHostname(set, process.env.NEXT_PUBLIC_SITE_URL)
  if (process.env.VERCEL_URL) {
    addHostname(set, `https://${process.env.VERCEL_URL}`)
  }
  return set
}

/**
 * Target when the user taps the notification: same-site path only
 * (blocks javascript:, data:, //evil, https://…).
 */
export function sanitizePushNavigatePath(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string') return fallback
  const s = raw.trim().slice(0, MAX_LEN)
  if (!s || !s.startsWith('/') || s.startsWith('//') || s.includes('://')) return fallback
  if (CTRL.test(s)) return fallback
  try {
    const u = new URL(s, 'https://placeholder.invalid')
    if (u.origin !== 'https://placeholder.invalid') return fallback
    return u.pathname + u.search + u.hash
  } catch {
    return fallback
  }
}

/**
 * icon / badge / image: relative path on this app, or https to an allowlisted host.
 */
export function sanitizePushAssetUrl(
  raw: unknown,
  allowedHosts: Set<string>
): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().slice(0, MAX_LEN)
  if (!s || CTRL.test(s)) return null

  if (s.startsWith('/') && !s.startsWith('//') && !s.includes('://')) {
    try {
      const u = new URL(s, 'https://placeholder.invalid')
      if (u.origin !== 'https://placeholder.invalid') return null
      return u.pathname + u.search + u.hash
    } catch {
      return null
    }
  }

  let parsed: URL
  try {
    parsed = new URL(s)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (!allowedHosts.has(parsed.hostname.toLowerCase())) return null
  return parsed.href
}
