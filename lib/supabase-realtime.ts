// Используем синглтон из lib/supabase — не создаём лишних GoTrueClient
import { supabase } from '@/lib/supabase';
export const supabaseRealtime = supabase;
export default supabaseRealtime;
