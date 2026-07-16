'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { JadwalUjian, Ujian } from '@/types';

export default function SiswaDashboard() {
  const { user, siswa, logout, isLoading } = useAuth();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [jadwalAktif, setJadwalAktif] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap] = useState<Record<string, Ujian>>({});
  // jadwalId -> status session ('berlangsung' | 'selesai' | 'force_submit' | null)
  const [sessionStatusMap, setSessionStatusMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'siswa' || !siswa) {
      router.replace('/login');
      return;
    }
    const currentSiswaId = siswa.id;
    setIsRefreshing(true);
    Promise.all([
      fetch(`/api/jadwal?siswaId=${currentSiswaId}`),
      fetch('/api/ujian'),
    ]).then(async ([jadwalRes, ujianRes]) => {
      if (!jadwalRes.ok || !ujianRes.ok) {
        console.error('Gagal memuat data dashboard siswa: salah satu API error');
        return;
      }
      const jadwals: JadwalUjian[] = await jadwalRes.json();
      const ujians: Ujian[]        = await ujianRes.json();
      const map: Record<string, Ujian> = {};
      ujians.forEach((u: Ujian) => { map[u.id] = u; });
      setUjianMap(map);
      setJadwalAktif(jadwals);

      // Load status session untuk setiap jadwal
      const sessionFetches = (jadwals as JadwalUjian[]).map((j: JadwalUjian) =>
        fetch(`/api/session?siswaId=${currentSiswaId}&jadwalId=${j.id}`)
          .then(r => r.json())
          .then(sess => ({ jadwalId: j.id, status: sess?.status ?? null }))
          .catch(() => ({ jadwalId: j.id, status: null }))
      );
      // FIX: await nested Promise.all agar tidak jadi floating promise
      const results = await Promise.all(sessionFetches);
      const sm: Record<string, string | null> = {};
      results.forEach(({ jadwalId, status }) => { sm[jadwalId] = status; });
      setSessionStatusMap(sm);
    }).catch(console.error).finally(() => setIsRefreshing(false));
  }, [isLoading, user, siswa, router, refreshKey]);

  if (isLoading || !user || !siswa) return null;

  function statusBadgeClass(status: string) {
    if (status === 'Published') return 'badge badge-success';
    return 'badge badge-neutral';
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <header className="topbar">
        <div className="topbar-left">
          <img src="/favicon.ico" alt="Logo MTS WAHA" width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} />
          <span className="topbar-appname">E-CBT MTS WAHA</span>
          <div className="topbar-divider" aria-hidden="true" />
          <span className="topbar-page-label">Dashboard Siswa</span>
        </div>
        <div className="topbar-center">
          <ThemeToggle />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setRefreshKey(k => k + 1)}
            aria-label="Muat ulang halaman"
            title="Muat ulang"
            style={{ marginLeft: '0.5rem' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
        <div className="topbar-right">
          <div className="topbar-user">
            <div className="topbar-avatar">{user.nama?.charAt(0)?.toUpperCase() ?? 'S'}</div>
            <span className="topbar-username">{user.nama}</span>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={async () => { await logout(); router.replace('/login'); }}
            aria-label="Keluar"
          >Keluar</button>
        </div>
      </header>

      {/* Content */}
      <main className="page-container" style={{ paddingTop: '1.5rem' }}>
        {/* Profil Singkat */}
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{siswa.nama}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Kelas: {siswa.nama_kelas ?? '-'}
            </div>
          </div>
          <span className="badge badge-primary">Siswa</span>
        </div>

        {/* Jadwal Aktif */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem', marginTop: 0 }}>
            Ujian Tersedia
          </h2>
          {jadwalAktif.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              Tidak ada ujian aktif saat ini.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.875rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {jadwalAktif.map(jadwal => {
                const ujian = ujianMap[jadwal.id_ujian];
                return (
                  <div key={jadwal.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                          {ujian?.nama_ujian ?? 'Ujian'}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{ujian?.jenis_ujian ?? '-'}</div>
                      </div>
                      <span className={statusBadgeClass(jadwal.status_publikasi)}>{jadwal.status_publikasi}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-subtle)' }}>
                      <span>{ujian?.durasi} menit</span>

                    </div>
                    {(() => {
                      const sessionStatus = sessionStatusMap[jadwal.id];
                      const sudahSelesai = sessionStatus === 'selesai' || sessionStatus === 'force_submit';

                      // Tanpa waktu_mulai, siswa bisa langsung mulai jika Published
                      if (jadwal.status_publikasi === 'Published') {
                        if (sudahSelesai) {
                          return (
                            <button
                              className="btn btn-outline btn-sm"
                              style={{ alignSelf: 'flex-start', color: 'var(--color-success)', borderColor: 'var(--color-success)', cursor: 'not-allowed', opacity: 0.7 }}
                              disabled
                            >
                              ✓ Selesai
                            </button>
                          );
                        }
                        return (
                          <Link
                            href={`/siswa/ujian?jadwal=${jadwal.id}`}
                            className="btn btn-primary btn-sm"
                            style={{ alignSelf: 'flex-start' }}
                          >
                            {sessionStatus === 'berlangsung' ? 'Lanjutkan Ujian' : 'Mulai Ujian'}
                          </Link>
                        );
                      }
                      return <button className="btn btn-outline btn-sm" disabled>Belum Dibuka</button>;
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {/* Loading overlay saat reload */}
      {isRefreshing && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          backgroundColor: 'rgba(0,0,0,0.45)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: '1rem',
        }}>
          <div style={{
            width: 48, height: 48,
            border: '4px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: '#fff', fontSize: '1.125rem', fontWeight: 600 }}>Sabar yaa!</span>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
