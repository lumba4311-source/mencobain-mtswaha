'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User, Siswa, Guru } from '@/types';
import { findUserByCredentials, getSiswaByUserId, getGuruByUserId } from '@/lib/store';

interface AuthContextType {
  user: User | null;
  siswa: Siswa | null;
  guru: Guru | null;
  login: (username: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [siswa, setSiswa] = useState<Siswa | null>(null);
  const [guru, setGuru] = useState<Guru | null>(null);

  // Restore session from sessionStorage
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('umbk_user');
      if (saved) {
        const parsed = JSON.parse(saved) as User;
        setUser(parsed);
        if (parsed.role === 'siswa') setSiswa(getSiswaByUserId(parsed.id));
        if (parsed.role === 'guru')  setGuru(getGuruByUserId(parsed.id));
      }
    } catch { /* ignore */ }
  }, []);

  function login(username: string, password: string): { ok: boolean; error?: string } {
    const found = findUserByCredentials(username, password);
    if (!found) return { ok: false, error: 'Username atau password salah.' };
    setUser(found);
    sessionStorage.setItem('umbk_user', JSON.stringify(found));
    if (found.role === 'siswa') setSiswa(getSiswaByUserId(found.id));
    if (found.role === 'guru')  setGuru(getGuruByUserId(found.id));
    return { ok: true };
  }

  function logout() {
    setUser(null);
    setSiswa(null);
    setGuru(null);
    sessionStorage.removeItem('umbk_user');
  }

  return (
    <AuthContext.Provider value={{ user, siswa, guru, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
