'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function ViewHistoryRecorder({ cardId }: { cardId: string }) {
  useEffect(() => {
    async function recordViewHistory() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
          return;
        }

        await supabase
          .from('view_history')
          .upsert(
            {
              user_id: user.id,
              card_id: cardId,
              viewed_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,card_id' }
          );
      } catch (err) {
        // Silently fail
      }
    }

    recordViewHistory();
  }, [cardId]);

  return null;
}
