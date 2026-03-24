import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { verifyRecaptchaToken, isValidScore } from "@/lib/recaptcha";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { email, password, recaptchaToken } = await req.json();

    // Проверка reCAPTCHA токена
    if (!recaptchaToken) {
      return NextResponse.json(
        { error: "reCAPTCHA токен не предоставлен" },
        { status: 400 }
      );
    }

    const captchaResult = await verifyRecaptchaToken(recaptchaToken);
    if (!captchaResult.success || !isValidScore(captchaResult.score)) {
      console.warn(
        `Failed reCAPTCHA validation for login: score=${captchaResult.score}, action=${captchaResult.action}`
      );
      return NextResponse.json(
        { error: "Не удалось пройти проверку безопасности. Пожалуйста, повторите попытку." },
        { status: 403 }
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

    // Логин через Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

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
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
