'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getStore, forceSubmitSession, autoTimeoutSweep } from '@/lib/store';
import type { JadwalUjian, Ujian, Siswa } from '@/types';
import ProktorSidebar from './ProktorSidebar';

type RowStatus = 'Belum Ujian' | 'Berlangsung' | 'Selesai';

interface MonitorRow {
  siswa: Siswa;
  kelas: string;
  durasi: number; // menit ujian
  status: RowStatus;
  sessionId?: string;
  progress: number; // persen
  jumlahDijawab: number;
  totalSoal: number;
}

export default function ProktorMonitoringPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [jadwalList, setJadwalList] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap]     = useState<Record<string, Ujian>>({});
  const [selectedId, setSelectedId] = useState(searchParams.get('jadwal') ?? '');
  const [rows, setRows]             = useState<MonitorRow[]>([]);
  const [now, setNow]               = useState(new Date());

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadBase();
  }, [user, router]);

  // Tick tiap detik
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-refresh tiap 5 detik
  useEffect(() => {
    if (!selectedId) return;
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [selectedId]);

  function loadBase() {
    const s = getStore();
    const uMap: Record<string, Ujian> = {};
    s.ujians.forEach(u => { uMap[u.id] = u; });
    setUjianMap(uMap);
    setJadwalList([...s.jadwalUjians]);
  }

  const refresh = useCallback(() => {
    autoTimeoutSweep();
    if (!selectedId) return;
    const s = getStore();
    const jadwal = s.jadwalUjians.find(j => j.id === selectedId);
    if (!jadwal) return;
    const ujian = s.ujians.find(u => u.id === jadwal.id_ujian);
    const durasi = ujian?.durasi ?? 0;
    const totalSoal = ujian ? s.soals.filter(sq => sq.id_ujian === ujian.id).length : 0;
    const kelasMap: Record<string, string> = {};
    s.kelas.forEach(k => { kelasMap[k.id] = k.nama_kelas; });

    const built: MonitorRow[] = jadwal.siswa_ids.map(sid => {
      const siswa = s.siswas.find(sw => sw.id === sid);
      if (!siswa) return null;
      const session = s.sessions.find(ses => ses.id_jadwal === selectedId && ses.id_siswa === sid);
      let status: RowStatus = 'Belum Ujian';
      if (session) {
        if (session.status === 'berlangsung') status = 'Berlangsung';
        else status = 'Selesai';
      }
      const jumlahDijawab = session
        ? s.jawabans.filter(j => j.id_session === session.id && j.jawaban_siswa !== null).length
        : 0;
      const progress = totalSoal > 0 ? Math.round((jumlahDijawab / totalSoal) * 100) : 0;
      return {
        siswa,
        kelas: kelasMap[siswa.id_kelas] ?? '—',
        durasi,
        status,
        sessionId: session?.id,
        progress,
        jumlahDijawab,
        totalSoal,
      } as MonitorRow;
    }).filter(Boolean) as MonitorRow[];

    setRows(built);
    loadBase();
  }, [selectedId]);

  function handleForce(sessionId: string) {
    forceSubmitSession(sessionId);
    refresh();
  }

  const selectedJadwal = jadwalList.find(j => j.id === selectedId);
  const selectedUjian  = selectedJadwal ? ujianMap[selectedJadwal.id_ujian] : null;

  const totalPeserta   = rows.length;
  const belumUjian     = rows.filter(r => r.status === 'Belum Ujian').length;
  const berlangsung    = rows.filter(r => r.status === 'Berlangsung').length;
  const selesai        = rows.filter(r => r.status === 'Selesai').length;

  function statusColor(s: RowStatus) {
    if (s === 'Berlangsung') return 'var(--color-warning)';
    if (s === 'Selesai')     return 'var(--color-success)';
    return 'var(--color-text-muted)';
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
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Monitoring Real-Time</h1>
            {selectedJadwal && selectedUjian && (
              <p style={{ margin: '0.125rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                {selectedUjian.nama_ujian} · {selectedJadwal.ruangan}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem', borderRadius: '0.5rem',
                border: '2px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontSize: '0.875rem', minWidth: 240,
              }}
            >
              <option value="">— Pilih Jadwal —</option>
              {jadwalList.map(j => (
                <option key={j.id} value={j.id}>
                  {ujianMap[j.id_ujian]?.nama_ujian ?? j.id} [{j.status}]
                </option>
              ))}
            </select>
            <button
              onClick={refresh}
              style={{
                padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                border: '2px solid var(--color-border)',
                background: 'var(--color-surface)', color: 'var(--color-text)',
                fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600,
              }}
            >↻ Refresh</button>
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {!selectedId ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📡</div>
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>Pilih jadwal untuk memulai monitoring</p>
            </div>
          ) : (
            <>
              {/* Ringkasan */}
              <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[
                  { label: 'Total Peserta', value: totalPeserta,  color: 'var(--color-text)' },
                  { label: 'Belum Ujian',   value: belumUjian,    color: 'var(--color-text-muted)' },
                  { label: 'Berlangsung',   value: berlangsung,   color: 'var(--color-warning)' },
                  { label: 'Selesai',       value: selesai,       color: 'var(--color-success)' },
                ].map(st => (
                  <div key={st.label} style={{
                    background: 'var(--color-surface)', border: '2px solid var(--color-border)',
                    borderRadius: '0.625rem', padding: '0.75rem 1.25rem',
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                  }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 800, color: st.color }}>{st.value}</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>{st.label}</span>
                  </div>
                ))}
              </div>

              {/* Tabel */}
              <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)' }}>
                        {['Kelas', 'Nama', 'Durasi', 'Status', 'Aksi'].map(h => (
                          <th key={h} style={{
                            padding: '0.625rem 1rem', textAlign: 'left',
                            fontSize: '0.75rem', fontWeight: 700,
                            color: 'var(--color-text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)',
                            whiteSpace: 'nowrap',
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, idx) => (
                        <tr key={row.siswa.id} style={{ borderBottom: idx < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                          {/* Kelas */}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{
                              padding: '0.125rem 0.5rem', borderRadius: '0.25rem',
                              background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                              fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)',
                            }}>{row.kelas}</span>
                          </td>
                          {/* Nama */}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{row.siswa.nama}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{row.siswa.nis}</div>
                          </td>
                          {/* Durasi */}
                          <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                            {row.durasi} menit
                          </td>
                          {/* Status */}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: statusColor(row.status) }}>
                              {row.status}
                            </span>
                            {row.status === 'Berlangsung' && (
                              <div style={{ marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div style={{ width: 80, height: 6, borderRadius: 3, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${row.progress}%`, background: 'var(--color-warning)', borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{row.jumlahDijawab}/{row.totalSoal}</span>
                              </div>
                            )}
                          </td>
                          {/* Aksi — Force Submit hanya saat Berlangsung */}
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {row.status === 'Berlangsung' && row.sessionId && (
                              <button
                                onClick={() => handleForce(row.sessionId!)}
                                style={{
                                  padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
                                  background: 'var(--color-danger)', border: 'none',
                                  color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >Force Submit</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.75rem', textAlign: 'right' }}>
                Auto-refresh setiap 5 detik · {now.toLocaleTimeString('id-ID')}
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
