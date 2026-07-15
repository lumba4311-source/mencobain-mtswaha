// ============================================================
// UMBK — MTS WAHA — Supabase Client
// ============================================================

import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── Browser Client Singleton ──────────────────────────────────
// Satu instance dipakai seluruh app agar storage key konsisten
// dan session tidak hilang antar render/mount.
let browserClientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    // SSR fallback — tidak boleh dipanggil di server, tapi aman
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  if (!browserClientInstance) {
    browserClientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken:  true,   // auto-refresh access token sebelum expired
        persistSession:    true,   // simpan session ke localStorage/cookie
        detectSessionInUrl: false, // tidak perlu OAuth callback
        storageKey: 'umbk-auth',   // key konsisten di localStorage
      },
    });
  }
  return browserClientInstance;
}

// ── Auth Client (khusus untuk signInWithPassword di API Routes) ─
export function createSupabaseAuthClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });
}

// ── Server Client (untuk query database, bypass RLS) ─────────
export function createSupabaseServerClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });
}
