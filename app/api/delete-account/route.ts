import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function handleDelete(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Missing Service Role Key" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Admin-клиент с service role ключом — создаётся внутри функции
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "Аккаунт удалён" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Неизвестная ошибка" }, { status: 500 });
  }
}

export const POST = handleDelete;
export const DELETE = handleDelete;
