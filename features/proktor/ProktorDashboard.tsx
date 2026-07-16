'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import type { JadwalUjian, Ujian } from '@/types';
import ProktorSidebar from './ProktorSidebar';
import AppTopbar from '@/components/AppTopbar';

export default function ProktorDashboard() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jadwalList, setJadwalList] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap] = useState<Record<string, Ujian>>({});

  const [totalSiswa, setTotalSiswa] = useState(0);
  const [totalGuru, setTotalGuru]   = useState(0);
  const [totalUjian, setTotalUjian] = useState(0);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadData();
  }, [isLoading, user, router]);

  async function loadData() {
    try {
      const [jadwalRes, ujianRes, akunRes] = await Promise.all([
        fetch('/api/jadwal'),
        fetch('/api/ujian'),
        fetch('/api/akun'),
      ]);
      // E-01: cek res.ok sebelum parse JSON — hindari crash saat API error
      if (!jadwalRes.ok || !ujianRes.ok || !akunRes.ok) {
        console.error('Gagal memuat data dashboard: salah satu API error');
        return;
      }
      const jadwals: JadwalUjian[] = await jadwalRes.json();
      const ujians: Ujian[]        = await ujianRes.json();
      const akun                   = await akunRes.json();

      const map: Record<string, Ujian> = {};
      ujians.forEach(u => { map[u.id] = u; });
      setUjianMap(map);
      setJadwalList(jadwals);
      setTotalSiswa(akun.siswas?.length ?? 0);
      setTotalGuru(akun.gurus?.length ?? 0);
      setTotalUjian(ujians.length);
    } catch (e) {
      console.error('Gagal memuat data dashboard:', e);
    }
  }

  const jadwalPublished = jadwalList.filter(j => j.status_publikasi === 'Published').length;
  const jadwalDraft     = jadwalList.filter(j => j.status_publikasi === 'Draft').length;

  function jadwalStatusBadge(status_publikasi: JadwalUjian['status_publikasi']) {
    if (status_publikasi === 'Published') return { cls: 'badge badge-success' };
    return { cls: 'badge badge-neutral' };
  }

  if (isLoading || !user) return null;

  /* ── Stat card data ── */
  const stats = [
    {
      label: 'Total Siswa',
      value: totalSiswa,
      borderColor: 'var(--color-secondary)',
      iconColor: 'var(--color-secondary)',
      iconBg: 'color-mix(in srgb, var(--color-secondary) 12%, transparent)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      ),
    },
    {
      label: 'Total Guru',
      value: totalGuru,
      borderColor: 'var(--color-primary)',
      iconColor: 'var(--color-primary)',
      iconBg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      ),
    },
    {
      label: 'Total Ujian',
      value: totalUjian,
      borderColor: '#7C6FD0',
      iconColor: '#7C6FD0',
      iconBg: 'color-mix(in srgb, #7C6FD0 12%, transparent)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
      ),
    },
    {
      label: 'Jadwal Published',
      value: jadwalPublished,
      borderColor: 'var(--color-success)',
      iconColor: 'var(--color-success)',
      iconBg: 'var(--color-success-bg)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20,6 9,17 4,12"/>
        </svg>
      ),
    },
    {
      label: 'Jadwal Draft',
      value: jadwalDraft,
      borderColor: 'var(--color-text-subtle)',
      iconColor: 'var(--color-text-subtle)',
      iconBg: 'var(--color-surface-raised)',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      {/* ── Full-width topbar ── */}
      <AppTopbar pageLabel="Dashboard" onMenuClick={() => setSidebarOpen(true)} />

      {/* ── Sidebar + content row ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ProktorSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <main style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>

        {/* ══ PAGE HEADER ══════════════════════════════════════════ */}
        <header style={{
          padding: '16px 24px 14px',
          borderBottom: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16,
          position: 'sticky', top: 0, zIndex: 30,
        }}>
          {/* Left — breadcrumb + page title */}
          <div style={{ minWidth: 0 }}>
            {/* Breadcrumb */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginBottom: 4,
            }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', fontWeight: 500 }}>
                Halaman
              </span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-subtle)', flexShrink: 0 }}>
                <polyline points="9,18 15,12 9,6"/>
              </svg>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-secondary)', fontWeight: 600 }}>
                Dashboard
              </span>
            </div>
            {/* Page title */}
            <h1 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}>
              Dashboard
            </h1>
          </div>

          {/* Right — primary CTA */}
          <Link
            href="/proktor/jadwal"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '7px 16px',
              background: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              borderRadius: 8,
              textDecoration: 'none',
              fontSize: '0.8125rem',
              fontWeight: 600,
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              transition: 'opacity 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = '0.85')}
            onMouseLeave={e => ((e.currentTarget as HTMLAnchorElement).style.opacity = '1')}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Buat Jadwal
          </Link>
        </header>

        {/* ══ PAGE BODY ═════════════════════════════════════════════ */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* ── STAT CARDS ── horizontal layout with colored left border */}
          <section aria-label="Ringkasan statistik">
            <div style={{
              fontSize: '0.6875rem',
              fontWeight: 700,
              color: 'var(--color-text-subtle)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 12,
            }}>
              Ringkasan
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(172px, 1fr))',
              gap: 12,
            }}>
              {stats.map(stat => (
                <div
                  key={stat.label}
                  style={{
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-border)',
                    borderLeft: `3px solid ${stat.borderColor}`,
                    borderRadius: 10,
                    padding: '16px 16px 16px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    boxShadow: 'var(--shadow-sm)',
                    transition: 'box-shadow 0.15s, transform 0.12s',
                    cursor: 'default',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-sm)';
                    (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                  }}
                >
                  {/* Left — big value */}
                  <div style={{
                    fontSize: '1.875rem',
                    fontWeight: 800,
                    color: 'var(--color-text)',
                    letterSpacing: '-0.04em',
                    lineHeight: 1,
                    flexShrink: 0,
                  }}>
                    {stat.value}
                  </div>
                  {/* Right — label + icon */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-end',
                    gap: 6,
                    minWidth: 0,
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: stat.iconBg,
                      color: stat.iconColor,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {stat.icon}
                    </div>
                    <span style={{
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                      color: 'var(--color-text-muted)',
                      textAlign: 'right',
                      lineHeight: 1.3,
                      whiteSpace: 'nowrap',
                    }}>
                      {stat.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── JADWAL TABLE ── */}
          <section aria-label="Daftar jadwal ujian">
            {/* Section header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <div>
                <div style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--color-text-subtle)',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  marginBottom: 2,
                }}>
                  Jadwal Ujian
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  {jadwalList.length > 0
                    ? `${jadwalList.length} jadwal terdaftar`
                    : 'Belum ada jadwal'}
                </div>
              </div>
              <Link
                href="/proktor/jadwal"
                style={{
                  fontSize: '0.75rem', fontWeight: 600,
                  color: 'var(--color-secondary)',
                  textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                Lihat semua
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9,18 15,12 9,6"/>
                </svg>
              </Link>
            </div>

            {/* Empty state */}
            {jadwalList.length === 0 ? (
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                padding: '48px 24px',
                textAlign: 'center',
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'var(--color-surface-raised)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                  color: 'var(--color-text-subtle)',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <p style={{ margin: '0 0 4px', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>
                  Belum ada jadwal ujian
                </p>
                <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                  Buat jadwal pertama untuk memulai.
                </p>
                <Link
                  href="/proktor/jadwal"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '7px 16px',
                    background: 'var(--color-primary)',
                    color: 'var(--color-text-inverse)',
                    borderRadius: 8,
                    textDecoration: 'none',
                    fontSize: '0.8125rem', fontWeight: 600,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Buat Jadwal
                </Link>
              </div>
            ) : (
              /* Table container */
              <div style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{
                    width: '100%', borderCollapse: 'collapse',
                    fontSize: '0.8125rem',
                  }}>
                     <thead>
                       <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                          {[
                            { label: 'Nama Ujian', align: 'left' },
                            { label: 'Durasi',     align: 'left' },
                            { label: 'Peserta',    align: 'center' },
                            { label: 'Status',     align: 'left' },
                            { label: 'Aksi',       align: 'center' },
                          ].map(col => (
                           <th
                             key={col.label}
                             style={{
                               padding: '10px 16px',
                               textAlign: col.align as 'left' | 'center',
                               fontSize: '0.6875rem',
                               fontWeight: 700,
                               color: 'var(--color-text-subtle)',
                               letterSpacing: '0.06em',
                               textTransform: 'uppercase',
                               whiteSpace: 'nowrap',
                               background: 'var(--color-surface-raised)',
                             }}
                           >
                             {col.label}
                           </th>
                         ))}
                       </tr>
                     </thead>
                     <tbody>
                       {jadwalList.map((j, idx) => {
                         const ujian = ujianMap[j.id_ujian];
                         const { cls } = jadwalStatusBadge(j.status_publikasi);
                         const isEven = idx % 2 === 1;
                         const isLast = idx === jadwalList.length - 1;
                         return (
                           <tr
                             key={j.id}
                             style={{
                               borderBottom: isLast ? 'none' : '1px solid var(--color-border-subtle)',
                               background: isEven ? 'var(--color-surface-raised)' : 'transparent',
                               transition: 'background 0.1s',
                             }}
                             onMouseEnter={e => {
                               (e.currentTarget as HTMLTableRowElement).style.background = 'var(--color-primary-subtle)';
                             }}
                             onMouseLeave={e => {
                               (e.currentTarget as HTMLTableRowElement).style.background = isEven ? 'var(--color-surface-raised)' : 'transparent';
                             }}
                           >
                             {/* Nama ujian */}
                             <td style={{ padding: '11px 16px', maxWidth: 240 }}>
                               <div style={{
                                 fontWeight: 600,
                                 color: 'var(--color-text)',
                                 whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                 lineHeight: 1.3,
                               }}>
                                 {ujian?.nama_ujian ?? '—'}
                               </div>
                               <div style={{
                                 fontSize: '0.75rem',
                                 color: 'var(--color-text-subtle)',
                                 marginTop: 2, lineHeight: 1.3,
                               }}>
                                 {ujian?.jenis_ujian ?? ''}
                               </div>
                             </td>
                              {/* Durasi */}
                              <td style={{ padding: '11px 16px', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                {j.durasi_menit} menit
                              </td>
                             {/* Peserta */}
                             <td style={{
                               padding: '11px 16px',
                               fontWeight: 700,
                               color: 'var(--color-text)',
                               textAlign: 'center',
                             }}>
                               {j.siswa_ids.length}
                             </td>
                             {/* Status */}
                             <td style={{ padding: '11px 16px' }}>
                               <span className={cls}>{j.status_publikasi}</span>
                             </td>
                             {/* Aksi */}
                             <td style={{ padding: '11px 16px', textAlign: 'center' }}>
                               <Link
                                 href="/proktor/jadwal"
                                 style={{
                                   display: 'inline-flex', alignItems: 'center', gap: 4,
                                   padding: '4px 10px',
                                   fontSize: '0.75rem', fontWeight: 600,
                                   color: 'var(--color-secondary)',
                                   background: 'color-mix(in srgb, var(--color-secondary) 10%, transparent)',
                                   border: '1px solid color-mix(in srgb, var(--color-secondary) 25%, transparent)',
                                   borderRadius: 6,
                                   textDecoration: 'none',
                                   whiteSpace: 'nowrap',
                                   transition: 'background 0.12s',
                                 }}
                                 onMouseEnter={e => {
                                   (e.currentTarget as HTMLAnchorElement).style.background = 'color-mix(in srgb, var(--color-secondary) 20%, transparent)';
                                 }}
                                 onMouseLeave={e => {
                                   (e.currentTarget as HTMLAnchorElement).style.background = 'color-mix(in srgb, var(--color-secondary) 10%, transparent)';
                                 }}
                               >
                                 Detail
                                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                   <polyline points="9,18 15,12 9,6"/>
                                 </svg>
                               </Link>
                             </td>
                           </tr>
                         );
                       })}
                     </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

        </div>
      </main>
      </div>
    </div>
  );
}
