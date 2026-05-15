import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { validateRegistrationEmail } from "@/lib/validate-registration-email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const emailRaw = typeof body?.email === "string" ? body.email : "";

    const validation = await validateRegistrationEmail(emailRaw);
    if (!validation.ok) {
      return NextResponse.json({ valid: false, issue: validation.issue }, { status: 400 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
      const { data: exists, error: rpcError } = await admin.rpc("auth_email_exists", {
        check_email: validation.email,
      });

      if (!rpcError && exists === true) {
        return NextResponse.json({ valid: false, issue: "already_registered" }, { status: 400 });
      }
    }

    return NextResponse.json({ valid: true, email: validation.email });
  } catch {
    return NextResponse.json({ error: "Не удалось проверить email." }, { status: 500 });
  }
}
