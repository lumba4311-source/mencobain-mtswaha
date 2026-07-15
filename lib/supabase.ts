// ============================================================
// UMBK — MTS WAHA — Supabase Client
// ============================================================

import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Mendapatkan URL Supabase yang dinamis dan valid baik untuk sisi server (dalam Docker)
 * maupun sisi client (browser di jaringan lokal / IP berbeda).
 */
export function getDynamicSupabaseUrl(isServer = typeof window === 'undefined'): string {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  if (isServer) {
    // Di server-side: cek jika berjalan di dalam container Docker dan URL Supabase mengarah ke localhost
    const isDocker = process.env.IS_DOCKER === 'true';
    if (isDocker) {
      try {
        const urlObj = new URL(envUrl);
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
          urlObj.hostname = 'ecbt_kong'; // Nama container/service gateway Kong di docker-compose
          return urlObj.toString().replace(/\/$/, '');
        }
      } catch (e) {
        // ignore
      }
    }
    return envUrl;
  } else {
    // Di client-side (browser): jika URL di env mengarah ke localhost/127.0.0.1,
    // tetapi diakses oleh browser dari IP/host lain di jaringan lokal
    try {
      const urlObj = new URL(envUrl);
      if (
        (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') &&
        window.location.hostname &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1'
      ) {
        urlObj.hostname = window.location.hostname;
      }
      return urlObj.toString().replace(/\/$/, '');
    } catch (e) {
      return envUrl;
    }
  }
}

// ── Browser Client Singleton ──────────────────────────────────
// Satu instance dipakai seluruh app agar storage key konsisten
// dan session tidak hilang antar render/mount.
let browserClientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  if (typeof window === 'undefined') {
    // SSR fallback — tidak boleh dipanggil di server, tapi aman
    return createBrowserClient(getDynamicSupabaseUrl(true), supabaseAnonKey);
  }
  if (!browserClientInstance) {
    const activeUrl = getDynamicSupabaseUrl(false);
    browserClientInstance = createBrowserClient(activeUrl, supabaseAnonKey, {
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
  return createClient(getDynamicSupabaseUrl(true), supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });
}

// ── Server Client (untuk query database, bypass RLS) ─────────
export function createSupabaseServerClient(): SupabaseClient {
  return createClient(getDynamicSupabaseUrl(true), supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });
}
