import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // Geliştirme ortamında .env dosyası unutulduysa konsolda net bir uyarı göster.
  // eslint-disable-next-line no-console
  console.warn(
    "[KPSS Koç] Supabase ortam değişkenleri bulunamadı. " +
      "VITE_SUPABASE_URL ve VITE_SUPABASE_ANON_KEY değerlerini .env dosyanıza ekleyin."
  );
}

// isSupabaseConfigured false ise supabase null olur; kullanan bileşenler
// bunu kontrol ederek anlaşılır bir hata mesajı gösterir.
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
