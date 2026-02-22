import { createBrowserClient } from '@supabase/ssr';

// createBrowserClient сохраняет сессию в Cookies (а не в localStorage),
// благодаря чему middleware на сервере видит актуальную авторизацию
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default supabase;
