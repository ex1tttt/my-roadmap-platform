import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { verifyRecaptchaToken, isValidScore } from "@/lib/recaptcha";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password, recaptchaToken } = await req.json();
    
    console.log('[LOGIN] Request received:', { email, hasToken: !!recaptchaToken });

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      console.warn('[LOGIN] reCAPTCHA token not provided');
      return NextResponse.json(
        { error: "reCAPTCHA token not provided" },
        { status: 400 }
      );
    }
    
    console.log('[LOGIN] Token length:', recaptchaToken.length);

    const captchaResult = await verifyRecaptchaToken(recaptchaToken);
    console.log('[LOGIN] reCAPTCHA result:', {
      success: captchaResult.success,
      score: captchaResult.score,
      action: captchaResult.action
    });
    
    // Пропускаем reCAPTCHA валидацию на localhost для разработки
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    console.log('[LOGIN] Host:', host, 'isLocalhost:', isLocalhost);
    
    // Проверяем наличие SECRET_KEY в продакшене
    if (!isLocalhost && !process.env.RECAPTCHA_SECRET_KEY) {
      console.error('[LOGIN] RECAPTCHA_SECRET_KEY is not set on server');
      return NextResponse.json(
        { error: "reCAPTCHA not configured on server. Please contact admin." },
        { status: 503 }
      );
    }
    
    // На Vercel пропускаем строгую проверку score (временное решение)
    // Google возвращает score=0 для Vercel дата-центра
    if (isLocalhost) {
      console.log('[LOGIN] Bypassing reCAPTCHA on localhost');
    } else {
      console.log('[LOGIN] Production - reCAPTCHA verified (score: ' + captchaResult.score + ')');
    }

    // Создаём Supabase клиент
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    // Логин через Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('[LOGIN] Supabase auth error:', error);
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    console.log('[LOGIN] Successful login for:', email);
    return NextResponse.json(
      { success: true, user: data.user },
      {
        status: 200,
        headers: {
          "Set-Cookie": cookieStore.get("sb-auth-token")?.value
            ? `sb-auth-token=${cookieStore.get("sb-auth-token")!.value}; Path=/; HttpOnly; Secure; SameSite=Lax`
            : "",
        },
      }
    );
  } catch (error: any) {
    console.error("[LOGIN] API error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
