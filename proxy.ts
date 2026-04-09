import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function proxy(req: NextRequest) {
  // res нужно объявлять через let, так как setAll может пересоздать его
  let res = NextResponse.next({ request: req })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        // Критично: обновляем куки и на req, и на res,
        // иначе Next.js не передаёт обновлённую сессию дальше
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          res = NextResponse.next({ request: req })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Обновляем сессию если она устарела (refresh token)
  const { data: { user } } = await supabase.auth.getUser()
  
  const pathname = req.nextUrl.pathname
  const hasSession = user?.id ? 'yes' : 'no'
  // Логирование для отладки (можно отключить в production)
  if (process.env.NODE_ENV === 'development' && (pathname === '/' || pathname.startsWith('/create') || pathname.startsWith('/profile'))) {
    console.log(`[PROXY] ${pathname}: session=${hasSession}`)
  }

  // Защита роута /create — пускаем, если сессия есть
  if (req.nextUrl.pathname.startsWith('/create')) {
    if (!user) {
      console.log('[PROXY] Redirecting to login - no session')
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }

  return res
}

// Применяем proxy ко всем маршрутам для корректного управления токенами
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg).*)',
  ],
}
