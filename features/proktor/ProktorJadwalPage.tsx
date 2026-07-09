'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  getStore, createJadwal, updateJadwal, deleteJadwal,
  bukaJadwal, tutupJadwal, publishJadwal, unpublishJadwal,
  type CreateJadwalInput,
} from '@/lib/store';
import type { JadwalUjian, Ujian, Kelas, Siswa } from '@/types';
import ProktorSidebar from './ProktorSidebar';

type Mode     = 'list' | 'buat' | 'edit';
type SortKey  = 'nama' | 'status' | 'publikasi' | 'waktu';
type SortDir  = 'asc' | 'desc';

const emptyForm = (): CreateJadwalInput => ({
  id_ujian: '', ruangan: '', max_capacity: 70,
  waktu_mulai: '', waktu_selesai: '', siswa_ids: [],
});

export default function ProktorJadwalPage() {
  const { user } = useAuth();
  const router   = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mode, setMode]         = useState<Mode>('list');
  const [jadwalList, setJadwalList] = useState<JadwalUjian[]>([]);
  const [ujianMap, setUjianMap] = useState<Record<string, Ujian>>({});
  const [ujianList, setUjianList]   = useState<Ujian[]>([]);
  const [kelasList, setKelasList]   = useState<Kelas[]>([]);
  const [siswaList, setSiswaList]   = useState<Siswa[]>([]);
  const [editId, setEditId]         = useState('');
  const [form, setForm]             = useState<CreateJadwalInput>(emptyForm());
  const [filterKelas, setFilterKelas] = useState('');
  const [error, setError]           = useState('');
  const [search, setSearch]         = useState('');
  const [sortKey, setSortKey]       = useState<SortKey>('waktu');
  const [sortDir, setSortDir]       = useState<SortDir>('asc');
  const [openMenu, setOpenMenu]     = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadData();
  }, [user, router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function loadData() {
    const s = getStore();
    const map: Record<string, Ujian> = {};
    s.ujians.forEach(u => { map[u.id] = u; });
    setUjianMap(map);
    setUjianList([...s.ujians]);
    setKelasList([...s.kelas]);
    setSiswaList([...s.siswas]);
    setJadwalList([...s.jadwalUjians]);
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return ' ↕';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  }

  function confirm(msg: string, action: () => void) {
    setConfirmMsg(msg);
    setConfirmAction(() => action);
  }

  function doConfirm() {
    confirmAction?.();
    setConfirmMsg('');
    setConfirmAction(null);
  }

  const filteredSorted = jadwalList
    .filter(j => {
      if (!search) return true;
      const ujian = ujianMap[j.id_ujian];
      return (
        (ujian?.nama_ujian ?? '').toLowerCase().includes(search.toLowerCase()) ||
        j.ruangan.toLowerCase().includes(search.toLowerCase())
      );
    })
    .sort((a, b) => {
      let v = 0;
      if (sortKey === 'nama')      v = (ujianMap[a.id_ujian]?.nama_ujian ?? '').localeCompare(ujianMap[b.id_ujian]?.nama_ujian ?? '');
      if (sortKey === 'status')    v = a.status.localeCompare(b.status);
      if (sortKey === 'publikasi') v = a.status_publikasi.localeCompare(b.status_publikasi);
      if (sortKey === 'waktu')     v = a.waktu_mulai.localeCompare(b.waktu_mulai);
      return sortDir === 'asc' ? v : -v;
    });

  function pelaksanaanLabel(j: JadwalUjian) {
    if (j.status === 'Dibuka')   return { text: '🟢 Berlangsung', color: 'var(--color-success)' };
    if (j.status === 'Menunggu') return { text: '⏳ Menunggu',     color: 'var(--color-warning)' };
    return                              { text: '✅ Selesai',       color: 'var(--color-text-muted)' };
  }

  function handleBuat() { setForm(emptyForm()); setEditId(''); setError(''); setMode('buat'); }

  function handleEdit(j: JadwalUjian) {
    setForm({
      id_ujian: j.id_ujian, ruangan: j.ruangan,
      max_capacity: j.max_capacity,
      waktu_mulai: j.waktu_mulai, waktu_selesai: j.waktu_selesai,
      siswa_ids: [...j.siswa_ids],
    });
    setEditId(j.id); setError(''); setMode('edit'); setOpenMenu(null);
  }

  function handleDelete(id: string) {
    setOpenMenu(null);
    confirm('Hapus jadwal ini?', () => { deleteJadwal(id); loadData(); });
  }

  function handleBuka(id: string) {
    setOpenMenu(null);
    if (!user) return;
    bukaJadwal(id, user.id); loadData();
  }

  function handleTutup(id: string) {
    setOpenMenu(null);
    confirm('Tutup sesi ujian ini? Peserta yang masih mengerjakan akan di-force submit.', () => { tutupJadwal(id); loadData(); });
  }

  function handlePublish(id: string) {
    setOpenMenu(null);
    confirm('Publish jadwal ini? Ujian akan tampil di dashboard siswa.', () => { publishJadwal(id); loadData(); });
  }

  function handleUnpublish(id: string) {
    setOpenMenu(null);
    const result = unpublishJadwal(id);
    if (!result.ok) { alert(result.error); return; }
    loadData();
  }

  function handleToggleSiswa(siswaId: string) {
    setForm(p => ({
      ...p,
      siswa_ids: p.siswa_ids.includes(siswaId)
        ? p.siswa_ids.filter(id => id !== siswaId)
        : [...p.siswa_ids, siswaId],
    }));
  }

  function handleSubmit() {
    setError('');
    if (!form.id_ujian)       { setError('Pilih ujian.'); return; }
    if (!form.ruangan.trim()) { setError('Ruangan wajib diisi.'); return; }
    if (!form.waktu_mulai)    { setError('Waktu mulai wajib diisi.'); return; }
    if (!form.waktu_selesai)  { setError('Waktu selesai wajib diisi.'); return; }
    if (new Date(form.waktu_selesai) <= new Date(form.waktu_mulai)) { setError('Waktu selesai harus setelah waktu mulai.'); return; }
    // Auto-assign semua siswa
    const allSiswaIds = siswaList.map(sw => sw.id);
    const finalForm = { ...form, siswa_ids: allSiswaIds };
    if (mode === 'buat') createJadwal(finalForm);
    else updateJadwal(editId, finalForm);
    loadData(); setMode('list');
  }

  const s = getStore();
  const kelasMap: Record<string, string> = {};
  s.kelas.forEach(k => { kelasMap[k.id] = k.nama_kelas; });
  const filteredSiswa = filterKelas ? siswaList.filter(sw => sw.id_kelas === filterKelas) : siswaList;

  if (!user) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <ProktorSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />

      <main style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{ padding: '1.25rem 1.5rem', borderBottom: '2px solid var(--color-border)', background: 'var(--color-surface)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>
              {mode === 'list' ? 'Kelola Jadwal Ujian' : mode === 'buat' ? 'Buat Jadwal Baru' : 'Edit Jadwal'}
            </h1>
            <p style={{ margin: '0.125rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {mode === 'list' ? 'Atur jadwal, publikasi, dan pelaksanaan ujian' : 'Isi detail jadwal ujian'}
            </p>
          </div>
          {mode === 'list'
            ? <button className="btn btn-primary btn-sm" onClick={handleBuat}>+ Buat Jadwal</button>
            : <button className="btn btn-ghost btn-sm" onClick={() => setMode('list')}>← Kembali</button>
          }
        </div>

        <div style={{ padding: '1.5rem' }}>

          {/* ── LIST MODE ── */}
          {mode === 'list' && (
            <>
              {/* Search */}
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem' }}>
                <input
                  type="text" placeholder="🔍 Cari ujian atau ruangan..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem 0.875rem', borderRadius: '0.5rem', border: '2px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text)', fontSize: '0.875rem', outline: 'none' }}
                />
              </div>

              <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
                {filteredSorted.length === 0 ? (
                  <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📋</div>
                    <p style={{ margin: 0, fontWeight: 600 }}>{search ? 'Tidak ada hasil yang cocok.' : 'Belum ada jadwal ujian.'}</p>
                    {!search && <button className="btn btn-primary btn-sm" onClick={handleBuat} style={{ marginTop: '1rem' }}>+ Buat Jadwal Pertama</button>}
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-surface-alt)' }}>
                          {[
                            { key: 'nama',      label: 'Ujian' },
                            { key: 'publikasi', label: 'Status' },
                            { key: 'status',    label: 'Pelaksanaan' },
                            { key: null,        label: 'Peserta' },
                            { key: null,        label: 'Durasi' },
                            { key: null,        label: 'Edit' },
                          ].map(h => (
                            <th key={h.label}
                              onClick={() => h.key && handleSort(h.key as SortKey)}
                              style={{
                                padding: '0.625rem 1rem', textAlign: 'left',
                                fontSize: '0.75rem', fontWeight: 700,
                                color: 'var(--color-text-muted)', textTransform: 'uppercase',
                                letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)',
                                cursor: h.key ? 'pointer' : 'default', whiteSpace: 'nowrap',
                                userSelect: 'none',
                              }}
                            >
                              {h.label}{h.key ? sortIcon(h.key as SortKey) : ''}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSorted.map((j, i) => {
                          const ujian = ujianMap[j.id_ujian];
                          const pel   = pelaksanaanLabel(j);
                          const isDraft = j.status_publikasi === 'Draft';
                          return (
                            <tr key={j.id} style={{ borderBottom: i < filteredSorted.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                              {/* Ujian */}
                              <td style={{ padding: '0.875rem 1rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{ujian?.nama_ujian ?? '—'}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                                  {ujian?.jenis_ujian} · {ujian?.durasi} menit · {j.ruangan}
                                </div>
                              </td>
                              {/* Status Publikasi — tombol toggle */}
                              <td style={{ padding: '0.875rem 1rem' }}>
                                <button
                                  onClick={() => isDraft ? handlePublish(j.id) : handleUnpublish(j.id)}
                                  style={{
                                    padding: '0.25rem 0.625rem', borderRadius: '9999px',
                                    fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', border: 'none',
                                    background: isDraft ? 'var(--color-surface-alt)' : 'rgba(34,197,94,0.15)',
                                    color: isDraft ? 'var(--color-text-muted)' : 'var(--color-success)',
                                    outline: `1px solid ${isDraft ? 'var(--color-border)' : 'var(--color-success)'}`,
                                  }}
                                >
                                  {isDraft ? 'Draft' : 'Published'}
                                </button>
                              </td>
                              {/* Pelaksanaan */}
                              <td style={{ padding: '0.875rem 1rem' }}>
                                <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: pel.color, whiteSpace: 'nowrap' }}>{pel.text}</span>
                              </td>
                              {/* Peserta */}
                              <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 700, color: 'var(--color-text)' }}>
                                {j.siswa_ids.length}
                              </td>
                              {/* Durasi */}
                              <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                {ujian?.durasi ?? '—'} menit
                              </td>
                              {/* Edit tombol langsung */}
                              <td style={{ padding: '0.875rem 1rem' }}>
                                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                                  {j.status === 'Menunggu' && (
                                    <button className="btn btn-outline btn-sm" onClick={() => handleEdit(j)}>Edit</button>
                                  )}
                                  {j.status === 'Menunggu' && (
                                    <button className="btn btn-success btn-sm" onClick={() => handleBuka(j.id)}>Buka</button>
                                  )}
                                  {j.status === 'Dibuka' && (
                                    <Link href={`/proktor/monitoring?jadwal=${j.id}`} className="btn btn-outline btn-sm">Monitor</Link>
                                  )}
                                  {j.status === 'Dibuka' && (
                                    <button className="btn btn-danger btn-sm" onClick={() => handleTutup(j.id)}>Tutup</button>
                                  )}
                                  {j.status === 'Ditutup' && (
                                    <Link href={`/proktor/hasil?jadwal=${j.id}`} className="btn btn-ghost btn-sm">Hasil</Link>
                                  )}
                                  {j.status === 'Menunggu' && (
                                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(j.id)}>Hapus</button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── BUAT / EDIT MODE ── */}
          {(mode === 'buat' || mode === 'edit') && (
            <div style={{ maxWidth: 640, background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {error && <div className="alert alert-danger">{error}</div>}

              <div className="form-group">
                <label className="form-label">Ujian</label>
                <select className="form-select" value={form.id_ujian} onChange={e => setForm(p => ({ ...p, id_ujian: e.target.value }))} disabled={mode === 'edit'}>
                  <option value="">— Pilih Ujian —</option>
                  {ujianList.map(u => <option key={u.id} value={u.id}>{u.nama_ujian} ({u.jenis_ujian})</option>)}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Ruangan</label>
                <input className="form-input" type="text" placeholder="Contoh: Lab Komputer 1" value={form.ruangan} onChange={e => setForm(p => ({ ...p, ruangan: e.target.value }))} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Waktu Mulai</label>
                  <input className="form-input" type="datetime-local" value={form.waktu_mulai ? form.waktu_mulai.slice(0, 16) : ''} onChange={e => setForm(p => ({ ...p, waktu_mulai: new Date(e.target.value).toISOString() }))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Waktu Selesai</label>
                  <input className="form-input" type="datetime-local" value={form.waktu_selesai ? form.waktu_selesai.slice(0, 16) : ''} onChange={e => setForm(p => ({ ...p, waktu_selesai: new Date(e.target.value).toISOString() }))} />
                </div>
              </div>

              {form.waktu_mulai && form.waktu_selesai && new Date(form.waktu_selesai) > new Date(form.waktu_mulai) && (
                <div style={{ padding: '0.625rem 0.875rem', background: 'var(--color-primary-subtle)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                  Durasi: {Math.round((new Date(form.waktu_selesai).getTime() - new Date(form.waktu_mulai).getTime()) / 60000)} menit
                </div>
              )}

              <div style={{ padding: '0.625rem 0.875rem', background: 'var(--color-surface-alt)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Peserta: semua siswa ({siswaList.length} siswa) akan otomatis di-assign.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setMode('list')}>Batal</button>
                <button className="btn btn-primary" onClick={handleSubmit}>{mode === 'buat' ? 'Buat Jadwal' : 'Simpan Perubahan'}</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirm dialog */}
      {confirmMsg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', width: 360 }}>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.9375rem', color: 'var(--color-text)', lineHeight: 1.5 }}>{confirmMsg}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setConfirmMsg(''); setConfirmAction(null); }}>Batal</button>
              <button className="btn btn-primary" onClick={doConfirm}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
