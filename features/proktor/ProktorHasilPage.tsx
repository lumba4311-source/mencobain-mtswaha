'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import CustomSelect from '@/components/CustomSelect';
import type { JadwalUjian, Ujian, Nilai, Siswa } from '@/types';
import ProktorSidebar from './ProktorSidebar';
import AppTopbar from '@/components/AppTopbar';
import Toast, { type ToastData } from '@/components/Toast';
import * as XLSX from 'xlsx';

export default function ProktorHasilPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [jadwalList, setJadwalList] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap] = useState<Record<string, Ujian>>({});
  const [selectedId, setSelectedId] = useState(searchParams.get('jadwal') ?? '');
  const [nilaiData, setNilaiData] = useState<Nilai[]>([]);
  const [siswaMap, setSiswaMap] = useState<Record<string, Siswa>>({});
  const [sortKey, setSortKey] = useState<'kelas' | 'nama' | 'nilai'>('kelas');
  const [sortAsc, setSortAsc] = useState(true);
  const [kelasMap, setKelasMap] = useState<Record<string, string>>({});
  const [loadingNilai, setLoadingNilai] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [search, setSearch] = useState('');
  const [filterTingkat, setFilterTingkat] = useState('');
  const [filterKelas, setFilterKelas] = useState('');
  const [showKelasModal, setShowKelasModal] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    // BUG FIX: load data dulu, lalu auto-load nilai jika ada jadwal id di URL param
    loadData().then(() => {
      if (selectedId) handleSelect(selectedId);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user, router]);

  async function loadData() {
    const [jadwalRes, ujianRes, akunRes] = await Promise.all([
      fetch('/api/jadwal'),
      fetch('/api/ujian'),
      fetch('/api/akun'),
    ]);
    // E-03: cek res.ok sebelum parse JSON — hindari crash saat API error
    if (!jadwalRes.ok || !ujianRes.ok || !akunRes.ok) {
      setToast({ msg: 'Gagal memuat data. Coba muat ulang halaman.', type: 'error' });
      return;
    }
    const jadwals: JadwalUjian[] = await jadwalRes.json();
    const ujians: Ujian[]        = await ujianRes.json();
    const akun                   = await akunRes.json();

    const uMap: Record<string, Ujian> = {};
    ujians.forEach(u => { uMap[u.id] = u; });
    setUjianMap(uMap);

    const sMap: Record<string, Siswa> = {};
    (akun.siswas ?? []).forEach((sw: Siswa) => { sMap[sw.id] = sw; });
    setSiswaMap(sMap);

    const kMap: Record<string, string> = {};
    (akun.kelas ?? []).forEach((k: { id: string; nama_kelas: string }) => { kMap[k.id] = k.nama_kelas; });
    setKelasMap(kMap);

    setJadwalList(jadwals);
  }

  async function handleSelect(id: string) {
    setSelectedId(id);
    setLoadingNilai(true);
    try {
      const res = await fetch(`/api/nilai?jadwalId=${id}`);
      if (!res.ok) { setToast({ msg: 'Gagal memuat data nilai.', type: 'error' }); return; }
      const data: Nilai[] = await res.json();
      setNilaiData(data);
    } catch {
      setToast({ msg: 'Terjadi kesalahan saat memuat nilai.', type: 'error' });
    } finally {
      setLoadingNilai(false);
    }
  }

  function handleExport() {
    if (!selectedId) return;
    const jadwal = jadwalList.find(j => j.id === selectedId);
    const ujian = jadwal ? ujianMap[jadwal.id_ujian] : null;
    if (!jadwal || !ujian) return;

    const rows = nilaiData.map((n, i) => {
      const siswa = siswaMap[n.id_siswa];
      const kelas = siswa ? kelasMap[siswa.id_kelas] : undefined;
      return {
        No: i + 1,
        Kelas: kelas ?? '—',
        Nama: siswa?.nama ?? '—',
        Nilai: parseFloat(String(n.nilai)),
        Benar: n.jumlah_benar,
        Salah: n.jumlah_salah,
        Status: n.lulus ? 'LULUS' : 'TIDAK LULUS',
        'Waktu Submit': new Date(n.submitted_at).toLocaleString('id-ID'),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');

    const filename = `Hasil_${ujian.nama_ujian.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  useEffect(() => {
    if (selectedId) handleSelect(selectedId);
  }, [selectedId]);

  const selectedJadwal = jadwalList.find(j => j.id === selectedId);
  const selectedUjian = selectedJadwal ? ujianMap[selectedJadwal.id_ujian] : null;

  // Derive tingkat & abjad dari nilaiData
  const allKelasNames = nilaiData.map(n => kelasMap[siswaMap[n.id_siswa]?.id_kelas ?? ''] ?? '').filter(Boolean);
  const tingkatList = Array.from(new Set(allKelasNames.map(k => k.match(/^\d+/)?.[0] ?? ''))).filter(Boolean).sort();
  const abjadList = filterTingkat
    ? Array.from(new Set(allKelasNames.filter(k => k.startsWith(filterTingkat)).map(k => k.replace(/^\d+/, '').trim()))).filter(Boolean).sort()
    : [];

  const totalPeserta = nilaiData.length;
  const lulus = nilaiData.filter(n => n.lulus).length;
  const tidakLulus = totalPeserta - lulus;
  const rataRata = totalPeserta > 0 ? (nilaiData.reduce((sum, n) => sum + parseFloat(String(n.nilai)), 0) / totalPeserta).toFixed(2) : '0.00';

  function handleSort(key: 'kelas' | 'nama' | 'nilai') {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  }
  function sortIcon(key: 'kelas' | 'nama' | 'nilai') {
    if (sortKey !== key) return ' ↕';
    return sortAsc ? ' ↑' : ' ↓';
  }
  function displayedNilai() {
    return [...nilaiData]
      .filter(n => {
        const siswa = siswaMap[n.id_siswa];
        const namaKelas = siswa ? (kelasMap[siswa.id_kelas] ?? '') : '';
        const q = search.toLowerCase();
        const matchSearch = !q || (siswa?.nama ?? '').toLowerCase().includes(q) || namaKelas.toLowerCase().includes(q);
        const matchTingkat = !filterTingkat || namaKelas.startsWith(filterTingkat);
        const matchKelas = !filterKelas || namaKelas === `${filterTingkat}${filterKelas}`;
        return matchSearch && matchTingkat && matchKelas;
      })
      .sort((a, b) => {
        const sa = siswaMap[a.id_siswa];
        const sb = siswaMap[b.id_siswa];
        let va = '', vb = '';
        if (sortKey === 'kelas') { va = kelasMap[sa?.id_kelas ?? ''] ?? ''; vb = kelasMap[sb?.id_kelas ?? ''] ?? ''; }
        else if (sortKey === 'nama') { va = sa?.nama ?? ''; vb = sb?.nama ?? ''; }
        else if (sortKey === 'nilai') { return sortAsc ? parseFloat(String(a.nilai)) - parseFloat(String(b.nilai)) : parseFloat(String(b.nilai)) - parseFloat(String(a.nilai)); }
        return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
      });
  }

  if (isLoading || !user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <AppTopbar pageLabel="Hasil Ujian" onMenuClick={() => setSidebarOpen(true)} />
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
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Hasil Ujian</h1>
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
                ...jadwalList.map(j => ({ value: j.id, label: ujianMap[j.id_ujian]?.nama_ujian ?? j.id })),
              ]}
            />
            {selectedId && (
              <button
                onClick={handleExport}
                style={{
                  padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                  background: 'var(--color-success)', border: 'none',
                  color: '#fff', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 700,
                }}
              >
                📥 Export Excel
              </button>
            )}
          </div>
        </div>

        <div style={{ padding: '1.5rem' }}>
          {!selectedId ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>Pilih jadwal untuk melihat hasil ujian</p>
            </div>
          ) : nilaiData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
              <p style={{ fontSize: '1rem', fontWeight: 600 }}>Belum ada hasil ujian untuk jadwal ini</p>
            </div>
          ) : (
            <>
              {/* Ringkasan */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                {[
                  { label: 'Total Peserta', value: totalPeserta, color: 'var(--color-text)' },
                  { label: 'Lulus', value: lulus, color: 'var(--color-success)' },
                  { label: 'Tidak Lulus', value: tidakLulus, color: 'var(--color-danger)' },
                  { label: 'Rata-rata', value: rataRata, color: 'var(--color-primary)' },
                ].map(st => (
                  <div key={st.label} style={{
                    background: 'var(--color-surface)', border: '2px solid var(--color-border)',
                    borderRadius: '0.625rem', padding: '0.875rem 1rem', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '1.75rem', fontWeight: 800, color: st.color, lineHeight: 1 }}>{st.value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontWeight: 600 }}>{st.label}</div>
                  </div>
                ))}
              </div>

              {/* Search & Filter */}
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <input
                  className="input"
                  type="text"
                  placeholder="🔍 Cari nama atau kelas..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, minWidth: 200 }}
                />
                <button
                  onClick={() => setShowKelasModal(true)}
                  style={{
                    padding: '0.5rem 0.875rem', borderRadius: '0.5rem',
                    border: `2px solid ${filterTingkat ? 'var(--color-primary)' : 'var(--color-border)'}`,
                    background: filterTingkat ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: filterTingkat ? '#fff' : 'var(--color-text)',
                    fontSize: '0.875rem', cursor: 'pointer', fontWeight: 600, whiteSpace: 'nowrap',
                  }}
                >
                  {filterTingkat
                    ? filterKelas ? `Kelas ${filterTingkat}${filterKelas}` : `Tingkat ${filterTingkat}`
                    : '🏫 Filter Kelas'}
                </button>
                {(search || filterTingkat) && (
                  <button
                    onClick={() => { setSearch(''); setFilterTingkat(''); setFilterKelas(''); }}
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
                        {([['kelas', 'Kelas'], ['nama', 'Nama'], ['nilai', 'Nilai']] as ['kelas'|'nama'|'nilai', string][]).map(([key, label]) => (
                          <th key={key} onClick={() => handleSort(key)} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)', cursor: 'pointer', userSelect: 'none' }}>
                            {label}{sortIcon(key)}
                          </th>
                        ))}
                        {['Benar', 'Salah'].map(h => (
                          <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const rows = displayedNilai();
                        if (rows.length === 0) return (
                          <tr><td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Tidak ada data yang cocok.</td></tr>
                        );
                        return rows.map((n, idx) => {
                          const siswa = siswaMap[n.id_siswa];
                          const namaKelas = siswa ? kelasMap[siswa.id_kelas] : undefined;
                          return (
                            <tr key={n.id} style={{ borderBottom: idx < rows.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                              <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{namaKelas ?? '—'}</td>
                              <td style={{ padding: '0.75rem 0.875rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--color-text)' }}>{siswa?.nama ?? '—'}</td>
                              <td style={{ padding: '0.75rem 0.875rem', fontSize: '1rem', fontWeight: 800, color: n.lulus ? 'var(--color-success)' : 'var(--color-danger)' }}>{parseFloat(String(n.nilai)).toFixed(0)}</td>
                              <td style={{ padding: '0.75rem 0.875rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-success)' }}>{n.jumlah_benar}</td>
                              <td style={{ padding: '0.75rem 0.875rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)' }}>{n.jumlah_salah}</td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
      </div>
      <Toast toast={toast} onClose={() => setToast(null)} />

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
                    >{t}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                  Pilih kelas atau lihat semua tingkat {filterTingkat}:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.625rem', marginBottom: '1rem' }}>
                  <button
                    onClick={() => { setFilterKelas(''); setShowKelasModal(false); }}
                    style={{
                      padding: '0.625rem 1rem', borderRadius: '0.5rem', cursor: 'pointer',
                      border: `2px solid ${!filterKelas ? 'var(--color-primary)' : 'var(--color-border)'}`,
                      fontWeight: 700, fontSize: '0.9375rem',
                      background: !filterKelas ? 'var(--color-primary)' : 'var(--color-surface-alt)',
                      color: !filterKelas ? '#fff' : 'var(--color-text)',
                    }}
                  >Semua {filterTingkat}</button>
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
                    >{filterTingkat}{a}</button>
                  ))}
                </div>
                <button
                  onClick={() => setFilterTingkat('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--color-text-muted)', padding: 0 }}
                >← Kembali ke pilih tingkat</button>
              </>
            )}

            <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end' }}>
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
    </div>
  );
}
