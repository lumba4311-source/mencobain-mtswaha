'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback, type ReactNode } from 'react';
import type { User, Siswa, Guru } from '@/types';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import { authLog, authWarn, authError } from '@/lib/authDebug';

interface AuthContextType {
  user:      User | null;
  siswa:     Siswa | null;
  guru:      Guru | null;
  isLoading: boolean;
  isOffline: boolean;
  login:  (username: string, password: string) => Promise<{ ok: boolean; error?: string; role?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user,      setUser]      = useState<User | null>(null);
  const [siswa,     setSiswa]     = useState<Siswa | null>(null);
  const [guru,      setGuru]      = useState<Guru | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  // Singleton browser client — stabil antar render
  const supabaseRef = useRef(createSupabaseBrowserClient());

  // ── fetchMe — validasi token ke server, support cookie + bearer ─
  const fetchMe = useCallback(async (token?: string): Promise<boolean> => {
    try {
      authLog('TOKEN_VALIDATION', token ? 'bearer' : 'cookie');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/auth/me', {
        headers,
        credentials: 'include', // kirim cookie HttpOnly secara otomatis
      });

      if (res.status === 401) {
        authWarn('SESSION_NOT_FOUND', 'Server returned 401');
        return false;
      }

      if (!res.ok) {
        authError('NETWORK_ERROR', `HTTP ${res.status}`);
        return false;
      }

      const data = await res.json();
      setUser(data.user);
      setSiswa(data.siswa ?? null);
      setGuru(data.guru ?? null);

      // Jika server mengembalikan token baru (setelah auto-refresh), update browser client
      if (data.access_token && data.refresh_token) {
        await supabaseRef.current.auth.setSession({
          access_token:  data.access_token,
          refresh_token: data.refresh_token,
        });
        authLog('AUTO_REFRESH_SESSION', 'Browser client session updated');
      }

      authLog('SESSION_RESTORED', `role=${data.user?.role}`);
      return true;
    } catch {
      authError('NETWORK_ERROR', 'fetchMe threw — network down?');
      return false;
    }
  }, []);

  // ── restoreSession — dijalankan saat mount dan saat online kembali ─
  const restoreSession = useCallback(async () => {
    authLog('TOKEN_VALIDATION', 'restoreSession start');

    // Coba dari localStorage/cookie via Supabase browser client dulu (offline-safe)
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession();
      if (session?.access_token) {
        authLog('SESSION_FOUND', 'Found in local storage, validating with server');
        const ok = await fetchMe(session.access_token);
        if (ok) {
          setIsOffline(false);
          setIsLoading(false);
          return;
        }
        // Token expired — coba refresh via server (cookie refresh_token)
        authWarn('ACCESS_TOKEN_EXPIRED', 'Trying server-side refresh via cookie');
      } else {
        authLog('SESSION_NOT_FOUND', 'No session in local storage, trying cookie');
      }
    } catch {
      authError('NETWORK_ERROR', 'getSession threw');
    }

    // Fallback: coba validasi via cookie HttpOnly (tidak perlu token di header)
    try {
      const ok = await fetchMe();
      if (ok) {
        setIsOffline(false);
        setIsLoading(false);
        return;
      }
    } catch {
      // Tidak bisa reach server — mungkin offline
      authError('NETWORK_ERROR', 'fetchMe (cookie) threw — possibly offline');
    }

    // Jika koneksi terputus tapi user sudah punya data di state, pertahankan
    if (!navigator.onLine) {
      authWarn('NETWORK_ERROR', 'Offline — preserving existing session state');
      setIsOffline(true);
      setIsLoading(false);
      return;
    }

    // Benar-benar tidak ada session valid
    authLog('REDIRECT_LOGIN', 'No valid session found');
    setUser(null);
    setSiswa(null);
    setGuru(null);
    setIsLoading(false);
  }, [fetchMe]);

  // ── Mount effect ──────────────────────────────────────────────
  useEffect(() => {
    restoreSession();

    // Listen perubahan auth state (login/logout/token refresh dari Supabase)
    const { data: { subscription } } = supabaseRef.current.auth.onAuthStateChange(
      async (event, session) => {
        authLog('TOKEN_VALIDATION', `onAuthStateChange event=${event}`);
        if (event === 'TOKEN_REFRESHED' && session?.access_token) {
          authLog('REFRESH_TOKEN_SUCCESS', 'Supabase auto-refreshed token');
          await fetchMe(session.access_token);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSiswa(null);
          setGuru(null);
        }
        // SIGNED_IN dan INITIAL_SESSION diabaikan — ditangani restoreSession
      }
    );

    // ── Online / Offline events ───────────────────────────────
    function handleOnline() {
      authLog('AUTO_REFRESH_SESSION', 'Network restored — re-validating session');
      setIsOffline(false);
      // Jika sebelumnya offline dan user masih di state, validasi ulang
      restoreSession();
    }
    function handleOffline() {
      authWarn('NETWORK_ERROR', 'Network lost');
      setIsOffline(true);
      // JANGAN logout — pertahankan state yang ada
    }

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [restoreSession, fetchMe]);

  // ── Login ─────────────────────────────────────────────────────
  async function login(username: string, password: string): Promise<{ ok: boolean; error?: string; role?: string }> {
    const res = await fetch('/api/auth/login', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include', // pastikan cookie diterima
      body:        JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error ?? 'Login gagal.' };
    }

    const data = await res.json();

    // Simpan ke Supabase browser client agar auto-refresh token berjalan
    if (data.access_token && data.refresh_token) {
      await supabaseRef.current.auth.setSession({
        access_token:  data.access_token,
        refresh_token: data.refresh_token,
      });
      authLog('LOGIN_SUCCESS', `role=${data.user?.role}`);
    }

    setUser(data.user);
    setSiswa(data.siswa ?? null);
    setGuru(data.guru ?? null);
    setIsOffline(false);

    authLog('REDIRECT_DASHBOARD', `role=${data.user?.role}`);
    return { ok: true, role: data.user?.role as string | undefined };
  }

  // ── Logout ────────────────────────────────────────────────────
  async function logout(): Promise<void> {
    authLog('REDIRECT_LOGIN', 'Manual logout');
    try {
      // Revoke server-side session dan hapus cookie
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      // Sign out dari browser client (bersihkan localStorage)
      await supabaseRef.current.auth.signOut();
    } catch (e) {
      // Abaikan error network — tetap clear state lokal
      authError('NETWORK_ERROR', `logout fetch/signOut threw: ${e}`);
    } finally {
      // Selalu clear state — termasuk saat network error
      setUser(null);
      setSiswa(null);
      setGuru(null);
      setIsLoading(false);
    }
  }

  return (
    <AuthContext.Provider value={{ user, siswa, guru, isLoading, isOffline, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
