"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function ViewHistoryRecorder({ cardId }: { cardId: string }) {
  useEffect(() => {
    if (!cardId) return;

    async function record() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const { error } = await supabase
        .from("view_history")
        .upsert(
          { user_id: user.id, card_id: cardId, viewed_at: new Date().toISOString() },
          { onConflict: "user_id,card_id" }
        );

      if (error) {
        console.error("[view_history] error:", error.code, error.message);
      }
    }

    record();
  }, [cardId]);

  return null;
}
