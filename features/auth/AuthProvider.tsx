'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { User, Siswa, Guru } from '@/types';
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

  // ── fetchMe — validasi token ke server via cookie HttpOnly ───
  const fetchMe = useCallback(async (token?: string): Promise<boolean> => {
    try {
      authLog('TOKEN_VALIDATION', token ? 'bearer' : 'cookie');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/auth/me', {
        headers,
        credentials: 'include',
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

    // Validasi via cookie HttpOnly yang disimpan saat login
    try {
      const ok = await fetchMe();
      if (ok) {
        setIsOffline(false);
        setIsLoading(false);
        return;
      }
    } catch {
      authError('NETWORK_ERROR', 'fetchMe threw — possibly offline');
    }

    // Jika offline tapi user masih punya state, pertahankan
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      authWarn('NETWORK_ERROR', 'Offline — preserving existing session state');
      setIsOffline(true);
      setIsLoading(false);
      return;
    }

    authLog('REDIRECT_LOGIN', 'No valid session found');
    setUser(null);
    setSiswa(null);
    setGuru(null);
    setIsLoading(false);
  }, [fetchMe]);

  // ── Mount effect ──────────────────────────────────────────────
  useEffect(() => {
    restoreSession();

    function handleOnline() {
      authLog('AUTO_REFRESH_SESSION', 'Network restored — re-validating session');
      setIsOffline(false);
      restoreSession();
    }
    function handleOffline() {
      authWarn('NETWORK_ERROR', 'Network lost');
      setIsOffline(true);
    }

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [restoreSession]);

  // ── Login ─────────────────────────────────────────────────────
  async function login(username: string, password: string): Promise<{ ok: boolean; error?: string; role?: string }> {
    const res = await fetch('/api/auth/login', {
      method:      'POST',
      headers:     { 'Content-Type': 'application/json' },
      credentials: 'include',
      body:        JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data.error ?? 'Login gagal.' };
    }

    const data = await res.json();

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
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      authError('NETWORK_ERROR', `logout fetch threw: ${e}`);
    } finally {
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
