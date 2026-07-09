'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { getStore, bukaJadwal, tutupJadwal } from '@/lib/store';
import type { JadwalUjian, Ujian } from '@/types';
import ProktorSidebar from './ProktorSidebar';

export default function ProktorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [jadwalList, setJadwalList] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap]     = useState<Record<string, Ujian>>({});

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadData();
  }, [user, router]);

  function loadData() {
    const s = getStore();
    const map: Record<string, Ujian> = {};
    s.ujians.forEach(u => { map[u.id] = u; });
    setUjianMap(map);
    setJadwalList([...s.jadwalUjians]);
  }

  function handleBuka(id: string) {
    if (!user) return;
    bukaJadwal(id, user.id);
    loadData();
  }

  function handleTutup(id: string) {
    tutupJadwal(id);
    loadData();
  }

  const s = getStore();
  const totalSiswa     = s.siswas.length;
  const totalGuru      = s.gurus.length;
  const totalUjian     = s.ujians.length;
  const jadwalDibuka   = jadwalList.filter(j => j.status === 'Dibuka').length;
  const jadwalMenunggu = jadwalList.filter(j => j.status === 'Menunggu').length;
  const jadwalSelesai  = jadwalList.filter(j => j.status === 'Ditutup').length;

  function jadwalStatusBadge(status: JadwalUjian['status']) {
    if (status === 'Dibuka')   return { cls: 'badge badge-success', bg: 'var(--color-success)' };
    if (status === 'Menunggu') return { cls: 'badge badge-warning', bg: 'var(--color-warning)' };
    return { cls: 'badge badge-neutral', bg: 'var(--color-text-muted)' };
  }

  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <ProktorSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />

      <main style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '2px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Dashboard</h1>
            <p style={{ margin: '0.125rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Ringkasan sistem E-CBT MTS WAHA
            </p>
          </div>
          <Link href="/proktor/jadwal" className="btn btn-primary btn-sm">+ Buat Jadwal</Link>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Siswa',     value: totalSiswa,     color: 'var(--color-primary)',     icon: '👩‍🎓' },
              { label: 'Total Guru',      value: totalGuru,      color: 'var(--color-info)',         icon: '👩‍🏫' },
              { label: 'Bank Ujian',      value: totalUjian,     color: 'var(--color-secondary)',    icon: '📝' },
              { label: 'Sedang Dibuka',   value: jadwalDibuka,   color: 'var(--color-success)',      icon: '🟢' },
              { label: 'Menunggu',        value: jadwalMenunggu, color: 'var(--color-warning)',      icon: '🟡' },
              { label: 'Selesai',         value: jadwalSelesai,  color: 'var(--color-text-muted)',   icon: '⚪' },
            ].map(st => (
              <div key={st.label} style={{
                background: 'var(--color-surface)',
                border: '2px solid var(--color-border)',
                borderRadius: '0.75rem',
                padding: '1.125rem 1rem',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: '1.75rem', lineHeight: 1, marginBottom: '0.375rem' }}>{st.icon}</div>
                <div style={{ fontSize: '1.875rem', fontWeight: 800, color: st.color, lineHeight: 1 }}>{st.value}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontWeight: 600 }}>{st.label}</div>
              </div>
            ))}
          </div>

          {/* Tabel jadwal */}
          <div style={{
            background: 'var(--color-surface)',
            border: '2px solid var(--color-border)',
            borderRadius: '0.75rem',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '1rem 1.25rem',
              borderBottom: '2px solid var(--color-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Jadwal Ujian</h2>
              <Link href="/proktor/jadwal" style={{ fontSize: '0.8125rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600 }}>
                Lihat semua →
              </Link>
            </div>

            {jadwalList.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <p style={{ margin: 0 }}>Belum ada jadwal ujian.</p>
                <Link href="/proktor/jadwal" className="btn btn-primary btn-sm" style={{ marginTop: '1rem', display: 'inline-block' }}>
                  + Buat Jadwal Pertama
                </Link>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-alt)' }}>
                      {['Ujian', 'Peserta', 'Status'].map(h => (
                        <th key={h} style={{
                          padding: '0.625rem 1rem', textAlign: 'left',
                          fontSize: '0.75rem', fontWeight: 700,
                          color: 'var(--color-text-muted)', textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          borderBottom: '2px solid var(--color-border)',
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {jadwalList.slice(0, 8).map((j, i) => {
                      const ujian = ujianMap[j.id_ujian];
                      const { cls } = jadwalStatusBadge(j.status);
                      return (
                        <tr key={j.id} style={{ borderBottom: i < jadwalList.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>
                              {ujian?.nama_ujian ?? '—'}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                              {ujian?.jenis_ujian} · {j.ruangan}
                            </div>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                            {j.siswa_ids.length}
                          </td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span className={cls}>{j.status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
