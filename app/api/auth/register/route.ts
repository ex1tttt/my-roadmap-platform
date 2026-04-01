import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { verifyRecaptchaToken, isValidScore } from "@/lib/recaptcha";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password, username, recaptchaToken } = await req.json();

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      console.warn('[REGISTER] reCAPTCHA токен не предоставлен');
      return NextResponse.json(
        { error: "reCAPTCHA токен не предоставлен" },
        { status: 400 }
      );
    }

    const captchaResult = await verifyRecaptchaToken(recaptchaToken);
    console.log('[REGISTER] reCAPTCHA result:', captchaResult);
    
    // Пропускаем reCAPTCHA валидацию на localhost для разработки
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
    console.log('[REGISTER] Host:', host, 'isLocalhost:', isLocalhost);

    // Проверяем наличие SECRET_KEY в продакшене
    if (!isLocalhost && !process.env.RECAPTCHA_SECRET_KEY) {
      console.error('[REGISTER] RECAPTCHA_SECRET_KEY не установлен на сервере');
      return NextResponse.json(
        { error: "reCAPTCHA не настроена на сервере. Свяжитесь с администратором. (Error: Missing RECAPTCHA_SECRET_KEY)" },
        { status: 503 }
      );
    }
    
    if (!isLocalhost && (!captchaResult.success || !isValidScore(captchaResult.score))) {
      console.warn(
        `[REGISTER] Failed reCAPTCHA validation: success=${captchaResult.success}, score=${captchaResult.score}, action=${captchaResult.action}`
      );
      return NextResponse.json(
        { error: "Не удалось пройти проверку безопасности. Пожалуйста, повторите попытку." },
        { status: 403 }
      );
    }
    
    if (isLocalhost) {
      console.log('[REGISTER] Skipping reCAPTCHA validation on localhost');
    }

    // Валидация username
    const USERNAME_RE = /^[a-zA-Z0-9_]{1,32}$/;
    if (!USERNAME_RE.test(username)) {
      return NextResponse.json(
        { error: "Ник может содержать только латинские буквы, цифры и знак _" },
        { status: 400 }
      );
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

    // Регистрация через Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      console.error('[REGISTER] Supabase signup error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const userId = data?.user?.id;
    if (userId) {
      // Создаём профиль
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({ id: userId, username });

      if (profileError) {
        console.error("[REGISTER] Profile insert error:", profileError);
        return NextResponse.json(
          { error: "Ошибка при создании профиля" },
          { status: 500 }
        );
      }
    }

    console.log('[REGISTER] Successful registration for:', email);
    return NextResponse.json(
      { success: true, user: data.user },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[REGISTER] API error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
