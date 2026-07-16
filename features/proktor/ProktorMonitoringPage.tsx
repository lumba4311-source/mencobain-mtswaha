'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import CustomSelect from '@/components/CustomSelect';
import type { JadwalUjian, Ujian, Siswa, Kelas } from '@/types';
import ProktorSidebar from './ProktorSidebar';
import AppTopbar from '@/components/AppTopbar';
import Toast, { type ToastData } from '@/components/Toast';

type RowStatus = 'Belum Ujian' | 'Berlangsung' | 'Selesai';

interface MonitorRow {
  siswa: Siswa;
  kelas: string;
  durasiBatas: number;
  sessionStartedAt?: string;
  sessionDeadline?: string;  // deadline dari server — single source of truth
  status: RowStatus;
  sessionId?: string;
  progress: number;
  jumlahDijawab: number;
  totalSoal: number;
}

export default function ProktorMonitoringPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jadwalList, setJadwalList] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap] = useState<Record<string, Ujian>>({});
  const [kelasMap, setKelasMap] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState(searchParams.get('jadwal') ?? '');
  const [rows, setRows] = useState<MonitorRow[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadBase();
  }, [isLoading, user, router]);

  // Tick tiap detik
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  async function loadBase() {
    const [jadwalRes, ujianRes, akunRes] = await Promise.all([
      fetch('/api/jadwal'),
      fetch('/api/ujian'),
      fetch('/api/akun'),
    ]);
    // E-05: cek res.ok sebelum parse JSON — hindari crash saat API error
    if (!jadwalRes.ok || !ujianRes.ok || !akunRes.ok) {
      console.error('Gagal memuat data monitoring: salah satu API error');
      return;
    }
    const ujians: Ujian[] = await ujianRes.json();
    const jadwals: JadwalUjian[] = await jadwalRes.json();
    const akun = await akunRes.json();
    const uMap: Record<string, Ujian> = {};
    ujians.forEach(u => { uMap[u.id] = u; });
    setUjianMap(uMap);
    setJadwalList(jadwals);
    // BUG FIX: load kelasMap agar nama kelas bisa ditampilkan
    const kMap: Record<string, string> = {};
    (akun.kelas ?? []).forEach((k: Kelas) => { kMap[k.id] = k.nama_kelas; });
    setKelasMap(kMap);
  }

  const refresh = useCallback(async () => {
    if (!selectedId) return;
    // E-04: cek res.ok sebelum parse JSON — circuit breaker agar interval tidak crash diam-diam
    try {
      const res = await fetch(`/api/monitoring?jadwalId=${selectedId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data)) return;

      const built: MonitorRow[] = data.map((item: {
        siswa: Siswa;
        sessionId?: string;
        status: string;
        sisa_waktu?: number;
        started_at?: string;
        deadline?: string;
        jumlahDijawab: number;
        totalSoal: number;
        progress: number;
        durasiBatas?: number;
      }) => {
        let rowStatus: RowStatus = 'Belum Ujian';
        if (item.status === 'berlangsung') rowStatus = 'Berlangsung';
        else if (item.status === 'selesai') rowStatus = 'Selesai';
        return {
          siswa: item.siswa,
          kelas: kelasMap[item.siswa.id_kelas] ?? item.siswa.id_kelas,
          durasiBatas: item.durasiBatas ?? 0,
          sessionStartedAt: item.started_at,
          sessionDeadline: item.deadline,
          status: rowStatus,
          sessionId: item.sessionId,
          progress: item.progress,
          jumlahDijawab: item.jumlahDijawab,
          totalSoal: item.totalSoal,
        };
      });
      setRows(built);
    } catch {
      // Network error — biarkan interval coba lagi berikutnya
    }
  }, [selectedId, kelasMap]);
  // Fetch sekali saat jadwal dipilih
  useEffect(() => {
    if (!selectedId) return;
    refresh();
  }, [selectedId, refresh]);

  async function handleForce(sessionId: string, namaSiswa: string) {
    setForceConfirm({ sessionId, namaSiswa });
  }

  async function doForceSubmit() {
    if (!forceConfirm) return;
    setForceLoading(true);
    try {
      const res = await fetch('/api/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: forceConfirm.sessionId }),
      });
      if (!res.ok) {
        setToast({ msg: 'Gagal melakukan force submit. Coba lagi.', type: 'error' });
        return;
      }
      setForceSuccess(`Jawaban ${forceConfirm.namaSiswa} berhasil dikumpulkan.`);
      setToast({ msg: `Jawaban ${forceConfirm.namaSiswa} berhasil dikumpulkan.`, type: 'success' });
      setTimeout(() => setForceSuccess(''), 4000);
      refresh();
    } catch {
      setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
    } finally {
      setForceLoading(false);
      setForceConfirm(null);
    }
  }

  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'kelas' | 'nama' | 'status'>('kelas');
  const [sortAsc, setSortAsc] = useState(true);
  const [filterStatus, setFilterStatus] = useState<RowStatus | ''>('');
  const [filterTingkat, setFilterTingkat] = useState('');   // e.g. '7', '8', '9'
  const [filterKelas, setFilterKelas] = useState('');       // e.g. 'A', 'B', 'C'
  const [showKelasModal, setShowKelasModal] = useState(false);
  const [forceConfirm, setForceConfirm] = useState<{ sessionId: string; namaSiswa: string } | null>(null);
  const [forceLoading, setForceLoading] = useState(false);
  const [forceSuccess, setForceSuccess] = useState<string>('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);

  // Derive list of tingkat and abjad from rows
  const tingkatList = Array.from(new Set(rows.map(r => r.kelas.match(/^\d+/)?.[0] ?? ''))).filter(Boolean).sort();
  const abjadList = filterTingkat
    ? Array.from(new Set(
        rows
          .filter(r => r.kelas.startsWith(filterTingkat))
          .map(r => r.kelas.replace(/^\d+/, '').trim())
      )).filter(Boolean).sort()
    : [];

  const selectedJadwal = jadwalList.find(j => j.id === selectedId);
  const selectedUjian = selectedJadwal ? ujianMap[selectedJadwal.id_ujian] : null;

  const totalPeserta = rows.length;
  const belumUjian = rows.filter(r => r.status === 'Belum Ujian').length;
  const berlangsung = rows.filter(r => r.status === 'Berlangsung').length;
  const selesai = rows.filter(r => r.status === 'Selesai').length;

  const STATUS_ORDER: Record<RowStatus, number> = { 'Berlangsung': 0, 'Belum Ujian': 1, 'Selesai': 2 };

  const displayedRows = rows
    .filter(r => {
      const q = search.toLowerCase();
      const matchSearch = !q || r.siswa.nama.toLowerCase().includes(q) || r.kelas.toLowerCase().includes(q);
      const matchStatus = !filterStatus || r.status === filterStatus;
      const matchTingkat = !filterTingkat || r.kelas.startsWith(filterTingkat);
      const matchKelas = !filterKelas || r.kelas === `${filterTingkat}${filterKelas}`;
      return matchSearch && matchStatus && matchTingkat && matchKelas;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'kelas') cmp = a.kelas.localeCompare(b.kelas);
      else if (sortKey === 'nama') cmp = a.siswa.nama.localeCompare(b.siswa.nama);
      else if (sortKey === 'status') cmp = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      return sortAsc ? cmp : -cmp;
    });

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: typeof sortKey }) {
    if (sortKey !== k) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ marginLeft: 4 }}>{sortAsc ? '↑' : '↓'}</span>;
  }

  if (isLoading || !user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <AppTopbar pageLabel="Monitoring Real-Time" onMenuClick={() => setSidebarOpen(true)} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ProktorSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
                  {selectedUjian.nama_ujian}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <CustomSelect
                value={selectedId}
                onChange={v => setSelectedId(v)}
                style={{ minWidth: 240 }}
                options={[
                  { value: '', label: '— Pilih Jadwal —' },
                  ...jadwalList.map(j => ({ value: j.id, label: `${ujianMap[j.id_ujian]?.nama_ujian ?? j.id} [${j.status_publikasi}]` })),
                ]}
              />
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
                    { label: 'Total Peserta', value: totalPeserta, color: 'var(--color-text)' },
                    { label: 'Belum Ujian', value: belumUjian, color: 'var(--color-text-muted)' },
                    { label: 'Berlangsung', value: berlangsung, color: 'var(--color-warning)' },
                    { label: 'Selesai', value: selesai, color: 'var(--color-success)' },
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

                {/* Search & Filter */}
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <input
                    className="input"
                    type="text"
                    placeholder="🔍 Cari nama, NIS, atau kelas..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <CustomSelect
                    value={filterStatus}
                    onChange={v => setFilterStatus(v as RowStatus | '')}
                    options={[
                      { value: '', label: 'Semua Status' },
                      { value: 'Berlangsung', label: 'Berlangsung' },
                      { value: 'Belum Ujian', label: 'Belum Ujian' },
                      { value: 'Selesai', label: 'Selesai' },
                    ]}
                  />
                  {/* Tombol filter kelas */}
                  <button
                    onClick={() => setShowKelasModal(true)}
                    style={{
                      padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                      border: `2px solid ${filterTingkat ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      background: filterTingkat ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: filterTingkat ? '#fff' : 'var(--color-text)',
                      fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {filterTingkat
                      ? filterKelas ? `Kelas ${filterTingkat}${filterKelas}` : `Tingkat ${filterTingkat}`
                      : '🏫 Filter Kelas'}
                  </button>
                  {(search || filterStatus || filterTingkat) && (
                    <button
                      onClick={() => { setSearch(''); setFilterStatus(''); setFilterTingkat(''); setFilterKelas(''); }}
                      style={{
                        padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                        border: '2px solid var(--color-border)',
                        background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                        fontSize: '0.875rem', cursor: 'pointer',
                      }}
                    >✕ Reset</button>
                  )}
                </div>

                {/* Tabel */}
                <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-alt)' }}>
                          {([
                            { label: 'Kelas', key: 'kelas' },
                            { label: 'Nama', key: 'nama' },
                            { label: 'Status', key: 'status' },
                            { label: 'Aksi', key: null },
                          ] as { label: string; key: typeof sortKey | null }[]).map(h => (
                            <th
                              key={h.label}
                              onClick={h.key ? () => toggleSort(h.key!) : undefined}
                              style={{
                                padding: '0.625rem 1rem', textAlign: 'left',
                                fontSize: '0.75rem', fontWeight: 700,
                                color: 'var(--color-text-muted)', textTransform: 'uppercase',
                                letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)',
                                whiteSpace: 'nowrap',
                                cursor: h.key ? 'pointer' : 'default',
                                userSelect: 'none',
                              }}
                            >
                              {h.label}{h.key && <SortIcon k={h.key} />}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {displayedRows.length === 0 ? (
                          <tr>
                            <td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                              Tidak ada data yang cocok.
                            </td>
                          </tr>
                        ) : displayedRows.map((row, idx) => (
                          <tr key={row.siswa.id} style={{ borderBottom: idx < displayedRows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            {/* Kelas */}
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <span style={{
                                padding: '0.125rem 0.5rem', borderRadius: '0.25rem',
                                background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                                fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)',
                              }}>
                                {row.kelas}
                              </span>
                            </td>
                            {/* Nama */}
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{row.siswa.nama}</div>
                            </td>
                            {/* Status — Belum Mulai / countdown / Selesai */}
                            <td style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                              {row.status === 'Belum Ujian' && (
                                <span style={{
                                  display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
                                  fontSize: '0.75rem', fontWeight: 700,
                                  background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)',
                                  color: 'var(--color-text-muted)',
                                }}>
                                  Belum Mulai
                                </span>
                              )}
                              {row.status === 'Selesai' && (
                                <span style={{
                                  display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
                                  fontSize: '0.75rem', fontWeight: 700,
                                  background: '#dcfce7', border: '1px solid #86efac',
                                  color: '#15803d',
                                }}>
                                  Selesai
                                </span>
                              )}
                              {row.status === 'Berlangsung' && (() => {
                                if (!row.sessionDeadline) return (
                                  <span style={{
                                    display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
                                    fontSize: '0.75rem', fontWeight: 700,
                                    background: '#fef9c3', border: '1px solid #fde047',
                                    color: '#854d0e',
                                  }}>Berlangsung</span>
                                );
                                // Gunakan deadline sebagai single source of truth — sama persis dengan ExamPage
                                const sisaSec = Math.max(0, Math.floor((new Date(row.sessionDeadline).getTime() - now.getTime()) / 1000));
                                const hh = Math.floor(sisaSec / 3600);
                                const mm = Math.floor((sisaSec % 3600) / 60).toString().padStart(2, '0');
                                const ss = (sisaSec % 60).toString().padStart(2, '0');
                                const timerStr = hh > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
                                const isUrgent = sisaSec < 300; // < 5 menit
                                return (
                                  <div>
                                    <span style={{
                                      display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '999px',
                                      fontSize: '0.75rem', fontWeight: 700, marginBottom: 4,
                                      background: isUrgent ? '#fee2e2' : '#fef9c3',
                                      border: `1px solid ${isUrgent ? '#fca5a5' : '#fde047'}`,
                                      color: isUrgent ? '#b91c1c' : '#854d0e',
                                    }}>
                                      Berlangsung
                                    </span>
                                    <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: isUrgent ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                                      {timerStr} tersisa
                                    </div>
                                    <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                      <div style={{ width: 72, height: 5, borderRadius: 3, background: 'var(--color-surface-alt)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', width: `${row.progress}%`, background: 'var(--color-warning)', borderRadius: 3 }} />
                                      </div>
                                      <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-muted)' }}>{row.jumlahDijawab}/{row.totalSoal}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                            {/* Aksi — Force Submit hanya saat Berlangsung */}
                            <td style={{ padding: '0.75rem 1rem' }}>
                              {row.status === 'Berlangsung' && row.sessionId && (
                                <button
                                  onClick={() => handleForce(row.sessionId!, row.siswa.nama)}
                                  disabled={forceLoading}
                                  style={{
                                    padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
                                    background: 'var(--color-danger)', border: 'none',
                                    color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                                    whiteSpace: 'nowrap', opacity: forceLoading ? 0.6 : 1,
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

              </>
            )}
          </div>
        </main>
      </div>

      {/* Notifikasi sukses force submit */}
      {forceSuccess && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 300,
          background: 'var(--color-success)', color: '#fff',
          padding: '0.75rem 1.25rem', borderRadius: '0.625rem',
          fontSize: '0.875rem', fontWeight: 600,
          boxShadow: 'var(--shadow-lg)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20,6 9,17 4,12" />
          </svg>
          {forceSuccess}
        </div>
      )}

      {/* Dialog konfirmasi force submit */}
      {/* Modal Pilih Kelas */}
      {showKelasModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}
          onClick={() => setShowKelasModal(false)}
        >
          <div
            style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', width: 400, boxShadow: 'var(--shadow-xl)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>
                {filterTingkat ? `Pilih Kelas Tingkat ${filterTingkat}` : 'Pilih Tingkat'}
              </span>
              <button
                onClick={() => setShowKelasModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: 'var(--color-text-muted)', lineHeight: 1 }}
              >✕</button>
            </div>

            {!filterTingkat ? (
              /* Step 1: pilih tingkat */
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Pilih tingkat kelas:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem' }}>
                  {tingkatList.map(t => (
                    <button
                      key={t}
                      onClick={() => { setFilterTingkat(t); setFilterKelas(''); }}
                      style={{
                        padding: '0.625rem 1.25rem', borderRadius: '0.5rem', cursor: 'pointer',
                        border: '2px solid var(--color-border)', fontWeight: 700, fontSize: '1.125rem',
                        background: 'var(--color-surface-alt)', color: 'var(--color-text)',
                        minWidth: 60, textAlign: 'center',
                      }}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Step 2: pilih abjad */
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Pilih kelas atau lihat semua tingkat {filterTingkat}:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginBottom: '1rem' }}>
                  {/* Tombol semua kelas tingkat ini */}
                  <button
                    onClick={() => { setFilterKelas(''); setShowKelasModal(false); }}
                    style={{
                      padding: '0.625rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
                      border: `2px solid ${!filterKelas ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      fontWeight: 700, fontSize: '0.9375rem',
                      background: !filterKelas ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                      color: !filterKelas ? '#fff' : 'var(--color-text)',
                    }}
                  >
                    Semua {filterTingkat}
                  </button>
                  {abjadList.map(a => (
                    <button
                      key={a}
                      onClick={() => { setFilterKelas(a); setShowKelasModal(false); }}
                      style={{
                        padding: '0.625rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
                        border: `2px solid ${filterKelas === a ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        fontWeight: 700, fontSize: '0.9375rem',
                        background: filterKelas === a ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                        color: filterKelas === a ? '#fff' : 'var(--color-text)',
                        minWidth: 52, textAlign: 'center',
                      }}
                    >
                      {filterTingkat}{a}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setFilterTingkat('')}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: 0,
                  }}
                >← Kembali ke pilih tingkat</button>
              </>
            )}

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              {(filterTingkat || filterKelas) && (
                <button
                  className="btn btn-ghost"
                  onClick={() => { setFilterTingkat(''); setFilterKelas(''); setShowKelasModal(false); }}
                >Reset Filter</button>
              )}
            </div>
          </div>
        </div>
      )}

      {forceConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 400 }}>
          <div style={{
            background: 'var(--color-surface)', border: '2px solid var(--color-border)',
            borderRadius: '0.75rem', padding: '1.5rem', width: 380, boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: '0.75rem' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-text)' }}>Konfirmasi Force Submit</span>
            </div>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: 'var(--color-text)', lineHeight: 1.6 }}>
              Kamu akan mengakhiri ujian <strong>{forceConfirm.namaSiswa}</strong> secara paksa.<br />
              Seluruh jawaban yang telah tersimpan akan dikumpulkan. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-ghost"
                onClick={() => setForceConfirm(null)}
                disabled={forceLoading}
              >Batal</button>
              <button
                className="btn btn-danger"
                onClick={doForceSubmit}
                disabled={forceLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--color-danger)', color: '#fff',
                  border: 'none', padding: '0.5rem 1rem', borderRadius: '0.5rem',
                  fontWeight: 600, cursor: forceLoading ? 'not-allowed' : 'pointer',
                  opacity: forceLoading ? 0.7 : 1,
                }}
              >
                {forceLoading && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                )}
                {forceLoading ? 'Memproses...' : 'Ya, Force Submit'}
              </button>
            </div>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
