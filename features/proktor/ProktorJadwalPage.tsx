'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
type CreateJadwalInput = { id_ujian: string; max_capacity: number; durasi_menit: number; siswa_ids: string[]; };
import CustomSelect from '@/components/CustomSelect';
import type { JadwalUjian, Ujian, Kelas, Siswa } from '@/types';
import ProktorSidebar from './ProktorSidebar';
import AppTopbar from '@/components/AppTopbar';
import Toast, { type ToastData } from '@/components/Toast';

type Mode     = 'list' | 'buat' | 'edit';
type SortKey  = 'nama' | 'publikasi' | 'waktu';
type SortDir  = 'asc' | 'desc';

const emptyForm = (): CreateJadwalInput => ({
  id_ujian: '', max_capacity: 70,
  durasi_menit: 90, siswa_ids: [],
});

export default function ProktorJadwalPage() {
  const { user, isLoading } = useAuth();
  const router   = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
  const [saving, setSaving]         = useState(false);
  const [toast, setToast]           = useState<ToastData | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadData();
  }, [isLoading, user, router]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function loadData() {
    const [jadwalRes, ujianRes, akunRes] = await Promise.all([
      fetch('/api/jadwal'),
      fetch('/api/ujian'),
      fetch('/api/akun'),
    ]);
    // E-07: cek res.ok sebelum parse JSON — hindari crash saat API error
    if (!jadwalRes.ok || !ujianRes.ok || !akunRes.ok) {
      setToast({ msg: 'Gagal memuat data. Coba muat ulang halaman.', type: 'error' });
      return;
    }
    const jadwals: JadwalUjian[] = await jadwalRes.json();
    const ujians: Ujian[]        = await ujianRes.json();
    const akun                   = await akunRes.json();

    const map: Record<string, Ujian> = {};
    ujians.forEach(u => { map[u.id] = u; });
    setUjianMap(map);
    setUjianList(ujians);
    setKelasList(akun.kelas ?? []);
    setSiswaList(akun.siswas ?? []);
    setJadwalList(jadwals);
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
      return (ujian?.nama_ujian ?? '').toLowerCase().includes(search.toLowerCase());
    })
    .sort((a, b) => {
      let v = 0;
      if (sortKey === 'nama')      v = (ujianMap[a.id_ujian]?.nama_ujian ?? '').localeCompare(ujianMap[b.id_ujian]?.nama_ujian ?? '');
      if (sortKey === 'publikasi') v = a.status_publikasi.localeCompare(b.status_publikasi);
      // BUG FIX: durasi_menit tidak ada di jadwal_ujians, sort pakai created_at sebagai fallback
      if (sortKey === 'waktu')     v = new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
      return sortDir === 'asc' ? v : -v;
    });

  function handleBuat() { setForm(emptyForm()); setEditId(''); setError(''); setMode('buat'); }

  function handleEdit(j: JadwalUjian) {
    setForm({
      id_ujian: j.id_ujian,
      max_capacity: j.max_capacity,
      durasi_menit: j.durasi_menit,
      siswa_ids: [...j.siswa_ids],
    });
    setEditId(j.id); setError(''); setMode('edit'); setOpenMenu(null);
  }

  function handleDelete(id: string) {
    setOpenMenu(null);
    confirm('Hapus jadwal ini? Tindakan ini tidak bisa dibatalkan.', async () => {
      try {
        const res = await fetch(`/api/jadwal/${id}`, { method: 'DELETE' });
        if (!res.ok) { setToast({ msg: 'Gagal menghapus jadwal.', type: 'error' }); return; }
        setToast({ msg: 'Jadwal berhasil dihapus.', type: 'success' });
        loadData();
      } catch {
        setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
      }
    });
  }

  function handlePublish(id: string) {
    setOpenMenu(null);
    confirm('Publish jadwal ini? Ujian akan tampil di dashboard siswa.', async () => {
      try {
        // Sync semua siswa ke jadwal saat publish, agar semua siswa bisa melihat ujian
        const allSiswaIds = siswaList.map(sw => sw.id);
        const res = await fetch(`/api/jadwal/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status_publikasi: 'Published', siswa_ids: allSiswaIds }),
        });
        if (!res.ok) { setToast({ msg: 'Gagal mempublish jadwal.', type: 'error' }); return; }
        setToast({ msg: 'Jadwal berhasil dipublish.', type: 'success' });
        loadData();
      } catch {
        setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
      }
    });
  }

  async function handleUnpublish(id: string) {
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/jadwal/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_publikasi: 'Draft' }),
      });
      if (!res.ok) { setToast({ msg: 'Gagal mengubah status jadwal.', type: 'error' }); return; }
      setToast({ msg: 'Jadwal diubah ke Draft.', type: 'success' });
      loadData();
    } catch {
      setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
    }
  }

  function handleToggleSiswa(siswaId: string) {
    setForm(p => ({
      ...p,
      siswa_ids: p.siswa_ids.includes(siswaId)
        ? p.siswa_ids.filter(id => id !== siswaId)
        : [...p.siswa_ids, siswaId],
    }));
  }

  async function handleSubmit() {
    setError('');
    if (!form.id_ujian)        { setError('Pilih ujian.'); return; }
    if (form.durasi_menit < 1) { setError('Durasi minimal 1 menit.'); return; }
    const allSiswaIds = siswaList.map(sw => sw.id);
    const finalForm = { ...form, siswa_ids: allSiswaIds };
    setSaving(true);
    try {
      if (mode === 'buat') {
        const res = await fetch('/api/jadwal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalForm),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Gagal membuat jadwal.'); return; }
        setToast({ msg: 'Jadwal berhasil dibuat.', type: 'success' });
      } else {
        const res = await fetch(`/api/jadwal/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalForm),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Gagal menyimpan jadwal.'); return; }
        setToast({ msg: 'Jadwal berhasil diperbarui.', type: 'success' });
      }
      loadData(); setMode('list');
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  const kelasMap: Record<string, string> = {};
  kelasList.forEach(k => { kelasMap[k.id] = k.nama_kelas; });
  const filteredSiswa = filterKelas ? siswaList.filter(sw => sw.id_kelas === filterKelas) : siswaList;

  if (isLoading || !user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <AppTopbar pageLabel="Kelola Jadwal" onMenuClick={() => setSidebarOpen(true)} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <ProktorSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
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
                  type="text" placeholder="🔍 Cari ujian..."
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
                            { key: 'nama',      label: 'Nama Ujian' },
                            { key: 'publikasi', label: 'Status' },
                            { key: null,        label: 'Durasi' },
                            { key: null,        label: 'Aksi' },
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
                          const isDraft = j.status_publikasi === 'Draft';
                          return (
                            <tr key={j.id} style={{ borderBottom: i < filteredSorted.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                              {/* Ujian */}
                              <td style={{ padding: '0.875rem 1rem' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{ujian?.nama_ujian ?? '—'}</div>
                                 <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>
                                   {ujian?.jenis_ujian} · {j.durasi_menit} menit
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
                               {/* Durasi */}
                               <td style={{ padding: '0.875rem 1rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                                 {j.durasi_menit} menit
                               </td>
                               {/* Aksi */}
                               <td style={{ padding: '0.875rem 1rem' }}>
                                 <div style={{ display: 'flex', gap: '0.375rem' }}>
                                   <button className="btn btn-outline btn-sm" onClick={() => handleEdit(j)}>Edit</button>
                                   <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDelete(j.id)}>Hapus</button>
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
                <CustomSelect
                  value={form.id_ujian}
                  onChange={v => setForm(p => ({ ...p, id_ujian: v }))}
                  disabled={mode === 'edit'}
                  options={[
                    { value: '', label: '— Pilih Ujian —' },
                    ...ujianList.map(u => ({ value: u.id, label: u.nama_ujian })),
                  ]}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Durasi Pengerjaan (menit)</label>
                <input
                  className="form-input"
                  type="number"
                  min={1} max={300}
                  value={form.durasi_menit === 0 ? '' : form.durasi_menit}
                  onChange={e => {
                    const val = e.target.value;
                    setForm(p => ({ ...p, durasi_menit: val === '' ? 0 : parseInt(val, 10) || 0 }));
                  }}
                />
              </div>

              <div style={{ padding: '0.625rem 0.875rem', background: 'var(--color-surface-alt)', borderRadius: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Semua siswa ({siswaList.length} siswa) akan otomatis di-assign sebagai peserta.
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setMode('list')} disabled={saving}>Batal</button>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                  {saving ? 'Menyimpan...' : mode === 'buat' ? 'Buat Jadwal' : 'Simpan Perubahan'}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirm dialog */}
      {confirmMsg && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', width: 'min(360px, calc(100vw - 2rem))' }}>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.9375rem', color: 'var(--color-text)', lineHeight: 1.5 }}>{confirmMsg}</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setConfirmMsg(''); setConfirmAction(null); }}>Batal</button>
              <button className="btn btn-primary" onClick={doConfirm}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
      </div>
    </div>
  );
}
