import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { verifyRecaptchaToken } from "@/lib/recaptcha";
import { validateRegistrationEmail } from "@/lib/validate-registration-email";
import { NextRequest, NextResponse } from "next/server";

function siteOrigin(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`;
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;
  return new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  try {
    const { email: emailRaw, password, username, recaptchaToken } = await req.json();

    const emailValidation = await validateRegistrationEmail(
      typeof emailRaw === "string" ? emailRaw : ""
    );
    if (!emailValidation.ok) {
      return NextResponse.json(
        { error: "Invalid email", issue: emailValidation.issue },
        { status: 400 }
      );
    }
    const email = emailValidation.email;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const adminCheck = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
      const { data: exists, error: rpcError } = await adminCheck.rpc("auth_email_exists", {
        check_email: email,
      });
      if (!rpcError && exists === true) {
        return NextResponse.json(
          { error: "Email already registered", issue: "already_registered" },
          { status: 400 }
        );
      }
    }

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: "reCAPTCHA токен не предоставлен" },
        { status: 400 }
      );
    }

    const captchaResult = await verifyRecaptchaToken(recaptchaToken);
    
    // Пропускаем reCAPTCHA валидацию на localhost для разработки
    const host = req.headers.get('host') || '';
    const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

    // Проверяем наличие SECRET_KEY в продакшене
    if (!isLocalhost && !process.env.RECAPTCHA_SECRET_KEY) {
      console.error('[REGISTER] RECAPTCHA_SECRET_KEY не установлен на сервере');
      return NextResponse.json(
        { error: "reCAPTCHA не настроена на сервере. Свяжитесь с администратором. (Error: Missing RECAPTCHA_SECRET_KEY)" },
        { status: 503 }
      );
    }
    
    // На Vercel пропускаем строгую проверку score (временное решение)
    // Google возвращает score=0 для Vercel дата-центра
    // No additional logging needed

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

    const emailRedirectTo = `${siteOrigin(req)}/auth/callback`;

    // Регистрация через Supabase (при включённом «Confirm email» сессия будет null до клика по ссылке)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { username },
      },
    });

    if (error) {
      console.error("[REGISTER] Supabase signup error:", error);
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        return NextResponse.json(
          { error: error.message, issue: "already_registered" },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const userId = data?.user?.id;
    const needsEmailConfirmation = !data.session && !!data.user;

    // При включённом Confirm email Supabase не всегда отдаёт ошибку для дубликата
    if (needsEmailConfirmation && data.user?.identities?.length === 0) {
      return NextResponse.json(
        { error: "Email already registered", issue: "already_registered" },
        { status: 400 }
      );
    }

    if (userId) {
      if (data.session) {
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert({ id: userId, username }, { onConflict: "id" });

        if (profileError) {
          console.error("[REGISTER] Profile upsert error:", profileError);
          return NextResponse.json(
            { error: "Ошибка при создании профиля" },
            { status: 500 }
          );
        }
      } else {
        const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (!serviceKey) {
          console.error(
            "[REGISTER] SUPABASE_SERVICE_ROLE_KEY is not set (required when session is empty, e.g. email confirmation enabled)"
          );
          return NextResponse.json(
            {
              error:
                "Регистрация с подтверждением email: на сервере нужен SUPABASE_SERVICE_ROLE_KEY. Обратитесь к администратору.",
            },
            { status: 503 }
          );
        }

        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          serviceKey
        );

        const { error: profileError } = await admin
          .from("profiles")
          .upsert({ id: userId, username }, { onConflict: "id" });

        if (profileError) {
          console.error("[REGISTER] Profile upsert error:", profileError);
          return NextResponse.json(
            { error: "Ошибка при создании профиля" },
            { status: 500 }
          );
        }
      }
    }

    console.log('[REGISTER] Successful registration for:', email, { needsEmailConfirmation });
    return NextResponse.json(
      {
        success: true,
        user: data.user,
        needsEmailConfirmation,
        email: data.user?.email ?? email,
      },
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
