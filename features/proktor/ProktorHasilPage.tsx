'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { getStore } from '@/lib/store';
import type { JadwalUjian, Ujian, Nilai, Siswa } from '@/types';
import ProktorSidebar from './ProktorSidebar';
import * as XLSX from 'xlsx';

export default function ProktorHasilPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [jadwalList, setJadwalList] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap] = useState<Record<string, Ujian>>({});
  const [selectedId, setSelectedId] = useState(searchParams.get('jadwal') ?? '');
  const [nilaiData, setNilaiData] = useState<Nilai[]>([]);
  const [siswaMap, setSiswaMap] = useState<Record<string, Siswa>>({});
  const [sortKey, setSortKey] = useState<'kelas' | 'nama' | 'nilai'>('kelas');
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadData();
  }, [user, router]);

  function loadData() {
    const s = getStore();
    const uMap: Record<string, Ujian> = {};
    s.ujians.forEach(u => { uMap[u.id] = u; });
    setUjianMap(uMap);

    const sMap: Record<string, Siswa> = {};
    s.siswas.forEach(sw => { sMap[sw.id] = sw; });
    setSiswaMap(sMap);

    const selesai = s.jadwalUjians.filter(j => j.status === 'Ditutup');
    setJadwalList(selesai);
  }

  function handleSelect(id: string) {
    setSelectedId(id);
    const s = getStore();
    const data = s.nilaiList.filter(n => n.id_jadwal === id);
    setNilaiData(data);
  }

  function handleExport() {
    if (!selectedId) return;
    const s = getStore();
    const jadwal = s.jadwalUjians.find(j => j.id === selectedId);
    const ujian = jadwal ? ujianMap[jadwal.id_ujian] : null;
    if (!jadwal || !ujian) return;

    const rows = nilaiData.map((n, i) => {
      const siswa = siswaMap[n.id_siswa];
      const kelasId = siswa?.id_kelas;
      const kelas = s.kelas.find(k => k.id === kelasId);
      return {
        No: i + 1,
        NIS: siswa?.nis ?? '—',
        Nama: siswa?.nama ?? '—',
        Kelas: kelas?.nama_kelas ?? '—',
        Benar: n.jumlah_benar,
        Salah: n.jumlah_salah,
        Kosong: n.jumlah_kosong,
        Nilai: n.nilai,
        KKM: ujian.nilai_kkm,
        Status: n.lulus ? 'LULUS' : 'TIDAK LULUS',
        'Waktu Submit': new Date(n.submitted_at).toLocaleString('id-ID'),
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Hasil Ujian');

    const filename = `Hasil_${ujian.nama_ujian.replace(/\s+/g, '_')}_${jadwal.ruangan.replace(/\s+/g, '_')}.xlsx`;
    XLSX.writeFile(workbook, filename);
  }

  useEffect(() => {
    if (selectedId) handleSelect(selectedId);
  }, [selectedId]);

  const selectedJadwal = jadwalList.find(j => j.id === selectedId);
  const selectedUjian = selectedJadwal ? ujianMap[selectedJadwal.id_ujian] : null;
  const s = getStore();
  const kelasMap: Record<string, string> = {};
  s.kelas.forEach(k => { kelasMap[k.id] = k.nama_kelas; });

  const totalPeserta = nilaiData.length;
  const lulus = nilaiData.filter(n => n.lulus).length;
  const tidakLulus = totalPeserta - lulus;
  const rataRata = totalPeserta > 0 ? (nilaiData.reduce((sum, n) => sum + n.nilai, 0) / totalPeserta).toFixed(2) : '0.00';

  function handleSort(key: 'kelas' | 'nama' | 'nilai') {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  }
  function sortIcon(key: 'kelas' | 'nama' | 'nilai') {
    if (sortKey !== key) return ' ↕';
    return sortAsc ? ' ↑' : ' ↓';
  }
  function sortedNilai() {
    return [...nilaiData].sort((a, b) => {
      const sa = siswaMap[a.id_siswa];
      const sb = siswaMap[b.id_siswa];
      let va = '', vb = '';
      if (sortKey === 'kelas') { va = kelasMap[sa?.id_kelas ?? ''] ?? ''; vb = kelasMap[sb?.id_kelas ?? ''] ?? ''; }
      else if (sortKey === 'nama') { va = sa?.nama ?? ''; vb = sb?.nama ?? ''; }
      else if (sortKey === 'nilai') { return sortAsc ? a.nilai - b.nilai : b.nilai - a.nilai; }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
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
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>Hasil Ujian</h1>
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
                  {ujianMap[j.id_ujian]?.nama_ujian ?? j.id}
                </option>
              ))}
            </select>
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

              {/* Tabel */}
              <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)' }}>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>No</th>
                        <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>NIS</th>
                        {([['nama', 'Nama'], ['kelas', 'Kelas'], ['nilai', 'Nilai']] as ['nama'|'kelas'|'nilai', string][]).map(([key, label]) => (
                          <th key={key} onClick={() => handleSort(key)} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)', cursor: 'pointer', userSelect: 'none' }}>
                            {label}{sortIcon(key)}
                          </th>
                        ))}
                        {['Benar', 'Salah', 'Kosong'].map(h => (
                          <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedNilai().map((n, idx) => {
                        const siswa = siswaMap[n.id_siswa];
                        return (
                          <tr key={n.id} style={{ borderBottom: idx < sortedNilai().length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <td style={{ padding: '0.75rem 0.875rem', color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>{idx + 1}</td>
                            <td style={{ padding: '0.75rem 0.875rem', fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{siswa?.nis ?? '—'}</td>
                            <td style={{ padding: '0.75rem 0.875rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{siswa?.nama ?? '—'}</td>
                            <td style={{ padding: '0.75rem 0.875rem' }}><span className="badge badge-neutral">{kelasMap[siswa?.id_kelas ?? ''] ?? '—'}</span></td>
                            <td style={{ padding: '0.75rem 0.875rem', fontSize: '1rem', fontWeight: 800, color: n.lulus ? 'var(--color-success)' : 'var(--color-danger)' }}>{n.nilai.toFixed(0)}</td>
                            <td style={{ padding: '0.75rem 0.875rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-success)' }}>{n.jumlah_benar}</td>
                            <td style={{ padding: '0.75rem 0.875rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-danger)' }}>{n.jumlah_salah}</td>
                            <td style={{ padding: '0.75rem 0.875rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-text-muted)' }}>{n.jumlah_kosong}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
