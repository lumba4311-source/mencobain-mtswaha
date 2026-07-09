'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getStore } from '@/lib/store';
import type { Ujian } from '@/types';

export default function GuruDashboard() {
  const { user, guru, logout } = useAuth();
  const router = useRouter();
  const [ujianList, setUjianList] = useState<Ujian[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'guru' || !guru) {
      router.replace('/login');
      return;
    }
    const store = getStore();
    const myUjian = store.ujians.filter(u => u.id_guru === guru.id);
    setUjianList(myUjian);
  }, [user, guru, router]);

  if (!user || !guru) return null;

  const store = getStore();
  const mapelMap: Record<string, string> = {};
  store.mataPelajaran.forEach(m => { mapelMap[m.id] = m.nama_mapel; });

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1 }}>
          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>E-CBT MTS WAHA</span>
          <span style={{ color: 'var(--color-border)', fontSize: '1rem' }}>|</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Dashboard Guru</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{user.nama}</span>
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); router.replace('/login'); }}>Keluar</button>
        </div>
      </header>

      <main className="page-container" style={{ paddingTop: '1.5rem' }}>
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', background: 'var(--color-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a2e22" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{guru.nama}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>NIP: {guru.nip}</div>
          </div>
          <span className="badge badge-secondary">Guru</span>
        </div>

        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>
              Bank Soal Saya
            </h2>
            <Link href="/guru/ujian/buat" className="btn btn-primary btn-sm">
              + Buat Ujian Baru
            </Link>
          </div>

          {ujianList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              Belum ada ujian. Klik tombol "Buat Ujian Baru" untuk memulai.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nama Ujian</th>
                    <th>Mata Pelajaran</th>
                    <th>Jenis</th>
                    <th>Durasi</th>
                    <th>KKM</th>
                    <th>Jumlah Soal</th>
                    <th>Dibuat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ujianList.map(ujian => {
                    const soalCount = store.soals.filter(s => s.id_ujian === ujian.id).length;
                    return (
                      <tr key={ujian.id}>
                        <td style={{ fontWeight: 500 }}>{ujian.nama_ujian}</td>
                        <td>{mapelMap[ujian.id_mapel] ?? '-'}</td>
                        <td><span className="badge badge-info">{ujian.jenis_ujian}</span></td>
                        <td>{ujian.durasi} menit</td>
                        <td>{ujian.nilai_kkm}</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{soalCount}</td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                          {new Date(ujian.created_at).toLocaleDateString('id-ID')}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <Link href={`/guru/soal?ujian=${ujian.id}`} className="btn btn-outline btn-sm">
                              Kelola Soal
                            </Link>
                            <Link href={`/guru/ujian/edit?ujian=${ujian.id}`} className="btn btn-ghost btn-sm">Edit</Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
