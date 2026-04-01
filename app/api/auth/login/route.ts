import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { verifyRecaptchaToken, isValidScore } from "@/lib/recaptcha";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password, recaptchaToken } = await req.json();

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      console.warn('[LOGIN] reCAPTCHA токен не предоставлен');
      return NextResponse.json(
        { error: "reCAPTCHA токен не предоставлен" },
        { status: 400 }
      );
    }

    const captchaResult = await verifyRecaptchaToken(recaptchaToken);
    console.log('[LOGIN] reCAPTCHA result:', captchaResult);
    
    // Пропускаем reCAPTCHA валидацию на localhost для разработки
    const isLocalhost = req.headers.get('host')?.includes('localhost') || req.headers.get('host')?.includes('127.0.0.1');
    console.log('[LOGIN] isLocalhost:', isLocalhost);
    
    if (!isLocalhost && (!captchaResult.success || !isValidScore(captchaResult.score))) {
      console.warn(
        `[LOGIN] Failed reCAPTCHA validation: success=${captchaResult.success}, score=${captchaResult.score}, action=${captchaResult.action}`
      );
      return NextResponse.json(
        { error: "Не удалось пройти проверку безопасности. Пожалуйста, повторите попытку." },
        { status: 403 }
      );
    }
    
    if (isLocalhost) {
      console.log('[LOGIN] Skipping reCAPTCHA validation on localhost');
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
