'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import Toast, { type ToastData } from '@/components/Toast';
import type { Ujian } from '@/types';

interface UjianWithSoalCount extends Ujian { soal_count: number; }

export default function GuruDashboard() {
  const { user, guru, logout, isLoading } = useAuth();
  const router = useRouter();
  const [ujianList, setUjianList] = useState<UjianWithSoalCount[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastData | null>(null);

  // Confirm modal state
  const [confirmTarget, setConfirmTarget] = useState<UjianWithSoalCount | null>(null);

  const doDeleteUjian = useCallback(async (ujian: UjianWithSoalCount) => {
    setConfirmTarget(null);
    setDeletingId(ujian.id);
    try {
      const res = await fetch(`/api/ujian/${ujian.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        setToast({ msg: data.error ?? 'Gagal menghapus ujian.', type: 'error' });
        return;
      }
      setUjianList(prev => prev.filter(u => u.id !== ujian.id));
      setToast({ msg: `Ujian "${ujian.nama_ujian}" berhasil dihapus.`, type: 'success' });
    } catch {
      setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
    } finally {
      setDeletingId(null);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'guru' || !guru) {
      router.replace('/login');
      return;
    }
    fetch(`/api/ujian?guruId=${guru.id}`)
      .then(async r => {
        // D-04: cek res.ok sebelum parse JSON
        if (!r.ok) { console.error('Gagal memuat daftar ujian guru'); return; }
        return r.json();
      })
      .then(data => { if (data) setUjianList(data ?? []); })
      .catch(console.error);
  }, [isLoading, user, guru, router]);

  if (isLoading || !user || !guru) return null;

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <header className="topbar">
        <div className="topbar-left">
          <img src="/favicon.ico" alt="Logo MTS WAHA" width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <span className="topbar-appname">E-CBT MTS WAHA</span>
          <div className="topbar-divider" aria-hidden="true" />
          <span className="topbar-page-label">Dashboard Guru</span>
        </div>
        <div className="topbar-center">
          <ThemeToggle />
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="topbar-avatar">{user.nama?.charAt(0)?.toUpperCase() ?? 'G'}</div>
            <span className="topbar-username">{user.nama}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => { await logout(); router.replace('/login'); }}
            aria-label="Keluar"
          >Keluar</button>
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
                    <th>Durasi</th>
                    <th>Jumlah Soal</th>
                    <th>Dibuat</th>
                    <th>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {ujianList.map(ujian => {
                    const soalCount = ujian.soal_count ?? 0;
                    return (
                      <tr key={ujian.id}>
                        <td style={{ fontWeight: 500 }}>{ujian.nama_ujian}</td>
                        <td>{ujian.durasi} menit</td>
                        <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{soalCount}</td>
                        <td style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                          {new Date(ujian.created_at).toLocaleDateString('id-ID')}
                        </td>
                         <td>
                          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                            <Link href={`/guru/soal?ujian=${ujian.id}`} className="btn btn-outline btn-sm">
                              Edit Soal
                            </Link>
                            <Link href={`/guru/ujian/edit?ujian=${ujian.id}`} className="btn btn-outline btn-sm">
                              Edit Ujian
                            </Link>
                            <button
                              className="btn btn-ghost btn-sm"
                              style={{ color: 'var(--color-danger)' }}
                              onClick={() => setConfirmTarget(ujian)}
                              disabled={deletingId === ujian.id}
                            >
                              {deletingId === ujian.id ? 'Menghapus...' : 'Hapus'}
                            </button>
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

      {/* Confirm modal hapus ujian */}
      {confirmTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', width: 380, maxWidth: '90vw' }}>
            <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Hapus Ujian</h2>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.9375rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
              Hapus ujian <strong>{confirmTarget.nama_ujian}</strong>?
            </p>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Semua soal di ujian ini akan ikut terhapus. Tindakan ini tidak bisa dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmTarget(null)}>Batal</button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}
                onClick={() => doDeleteUjian(confirmTarget)}
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
