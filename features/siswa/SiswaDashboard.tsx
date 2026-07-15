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
  const [jadwalAktif, setJadwalAktif] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap] = useState<Record<string, Ujian>>({});
  const [kelasMap, setKelasMap] = useState<Record<string, string>>({});
  // jadwalId -> status session ('berlangsung' | 'selesai' | 'force_submit' | null)
  const [sessionStatusMap, setSessionStatusMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'siswa' || !siswa) {
      router.replace('/login');
      return;
    }
    const currentSiswaId = siswa.id;
    Promise.all([
      fetch(`/api/jadwal?siswaId=${currentSiswaId}`),
      fetch('/api/ujian'),
      fetch('/api/akun'),
    ]).then(async ([jadwalRes, ujianRes, akunRes]) => {
      // C-01/C-02: cek res.ok sebelum parse JSON — hindari crash saat API error
      if (!jadwalRes.ok || !ujianRes.ok || !akunRes.ok) {
        console.error('Gagal memuat data dashboard siswa: salah satu API error');
        return;
      }
      const jadwals: JadwalUjian[] = await jadwalRes.json();
      const ujians: Ujian[]        = await ujianRes.json();
      const akun                   = await akunRes.json();
      const map: Record<string, Ujian> = {};
      ujians.forEach((u: Ujian) => { map[u.id] = u; });
      setUjianMap(map);
      setJadwalAktif(jadwals);
      const km: Record<string, string> = {};
      (akun.kelas ?? []).forEach((k: { id: string; nama_kelas: string }) => { km[k.id] = k.nama_kelas; });
      setKelasMap(km);

      // Load status session untuk setiap jadwal
      const sessionFetches = (jadwals as JadwalUjian[]).map((j: JadwalUjian) =>
        fetch(`/api/session?siswaId=${currentSiswaId}&jadwalId=${j.id}`)
          .then(r => r.json())
          .then(sess => ({ jadwalId: j.id, status: sess?.status ?? null }))
          .catch(() => ({ jadwalId: j.id, status: null }))
      );
      Promise.all(sessionFetches).then(results => {
        const sm: Record<string, string | null> = {};
        results.forEach(({ jadwalId, status }) => { sm[jadwalId] = status; });
        setSessionStatusMap(sm);
      });
    }).catch(console.error);
  }, [isLoading, user, siswa, router]);

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
              Kelas: {kelasMap[siswa.id_kelas] ?? '-'}
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
    </div>
  );
}
