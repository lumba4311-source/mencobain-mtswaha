'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import type { Siswa, Guru, Kelas, User } from '@/types';
import CustomSelect from '@/components/CustomSelect';
import ProktorSidebar from './ProktorSidebar';
import AppTopbar from '@/components/AppTopbar';
import Toast, { type ToastData } from '@/components/Toast';

type Tab  = 'siswa' | 'guru';
type Mode = 'list' | 'tambah' | 'edit' | 'import';
type SortKey = 'kelas' | 'nama' | 'username';

export default function ProktorAkunPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [tab, setTab]   = useState<Tab>('siswa');
  const [mode, setMode] = useState<Mode>('list');
  const [editId, setEditId] = useState('');
  const [error, setError]   = useState('');

  // Sorting & search
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('kelas');
  const [sortAsc, setSortAsc] = useState(true);

  // Import Excel (paste)
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importSuccess, setImportSuccess] = useState(0);

  // Data
  const [siswaList, setSiswaList] = useState<Siswa[]>([]);
  const [guruList,  setGuruList]  = useState<Guru[]>([]);
  const [userMap,   setUserMap]   = useState<Record<string, User>>({});
  const [kelasList, setKelasList] = useState<Kelas[]>([]);

  // Forms
  const [siswForm, setSiswForm] = useState({ nama: '', id_kelas: '', username: '', password: '' });
  const [guruForm, setGuruForm] = useState({ nama: '', username: '', password: '' });

  // Reset password modal
  const [rpTarget, setRpTarget] = useState('');
  const [rpVal,    setRpVal]    = useState('');

  // Loading states
  const [savingAkun, setSavingAkun]       = useState(false);
  const [deletingId, setDeletingId]       = useState('');
  const [savingRp,   setSavingRp]         = useState(false);
  const [importing,  setImporting]        = useState(false);

  // Confirm modal
  const [confirmMsg,    setConfirmMsg]    = useState('');
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastData | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadData();
  }, [isLoading, user, router]);

  function loadData() {
    fetch('/api/akun')
      .then(async r => {
        if (!r.ok) throw new Error(`API error ${r.status}`);
        return r.json();
      })
      .then(akun => {
        const map: Record<string, User> = {};
        (akun.profiles ?? []).forEach((p: User) => { map[p.id] = p; });
        setUserMap(map);
        setSiswaList(akun.siswas ?? []);
        setGuruList(akun.gurus ?? []);
        setKelasList(akun.kelas ?? []);
      })
      .catch(err => {
        console.error('loadData gagal:', err);
        setToast({ msg: 'Gagal memuat data akun.', type: 'error' });
      });
  }

  // ── Siswa handlers ─────────────────────────────────────────

  function handleTambahSiswa() {
    setSiswForm({ nama: '', id_kelas: '', username: '', password: '' });
    setEditId(''); setError(''); setMode('tambah');
  }

  function handleEditSiswa(siswa: Siswa) {
    const u = userMap[siswa.id_user];
    setSiswForm({ nama: siswa.nama, id_kelas: siswa.id_kelas, username: u?.username ?? '', password: '' });
    // BUG FIX: pakai id_user bukan id — userId di API adalah auth user id
    setEditId(siswa.id_user); setError(''); setMode('edit');
  }

  async function handleSaveSiswa() {
    setError('');
    if (!siswForm.nama.trim())     { setError('Nama wajib diisi.'); return; }
    if (!siswForm.id_kelas)        { setError('Kelas wajib dipilih.'); return; }
    if (!siswForm.username.trim()) { setError('Username wajib diisi.'); return; }
    if (mode === 'tambah') {
      if (!siswForm.password.trim()) { setError('Password wajib diisi.'); return; }
      if (siswForm.password.trim().length < 6) { setError('Password minimal 6 karakter.'); return; }
    } else {
      if (siswForm.password.trim() && siswForm.password.trim().length < 6) { setError('Password minimal 6 karakter.'); return; }
    }
    setSavingAkun(true);
    try {
      if (mode === 'tambah') {
        const res = await fetch('/api/akun', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: siswForm.username.trim(), password: siswForm.password, nama: siswForm.nama.trim(), role: 'siswa', nis: siswForm.username.trim(), id_kelas: siswForm.id_kelas }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Gagal menyimpan.'); return; }
      } else {
        const patchBody: Record<string, string> = { userId: editId, nama: siswForm.nama.trim(), id_kelas: siswForm.id_kelas };
        // Hanya kirim password jika diisi — kosong = tidak diubah
        if (siswForm.password.trim()) patchBody.password = siswForm.password.trim();
        const res = await fetch('/api/akun', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Gagal menyimpan.'); return; }
      }
      setSiswForm({ nama: '', id_kelas: '', username: '', password: '' });
      setToast({ msg: `Siswa berhasil ${mode === 'tambah' ? 'ditambahkan' : 'diperbarui'}.`, type: 'success' });
      loadData(); setMode('list');
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setSavingAkun(false);
    }
  }

  async function handleDeleteSiswa(id: string) {
    setConfirmMsg('Hapus siswa ini? Tindakan tidak bisa dibatalkan.');
    setConfirmAction(() => async () => {
      setDeletingId(id);
      try {
        const res = await fetch(`/api/akun?id=${id}&type=siswa`, { method: 'DELETE' });
        if (!res.ok) { setToast({ msg: 'Gagal menghapus siswa.', type: 'error' }); return; }
        setToast({ msg: 'Siswa berhasil dihapus.', type: 'success' });
        loadData();
      } catch {
        setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
      } finally {
        setDeletingId('');
      }
    });
  }

  // ── Guru handlers ──────────────────────────────────────────

  function handleTambahGuru() {
    setGuruForm({ nama: '', username: '', password: '' });
    setEditId(''); setError(''); setMode('tambah');
  }

  function handleEditGuru(guru: Guru) {
    const u = userMap[guru.id_user];
    setGuruForm({ nama: guru.nama, username: u?.username ?? '', password: '' });
    // BUG FIX: pakai id_user bukan id
    setEditId(guru.id_user); setError(''); setMode('edit');
  }

  async function handleSaveGuru() {
    setError('');
    if (!guruForm.nama.trim())     { setError('Nama wajib diisi.'); return; }
    if (!guruForm.username.trim()) { setError('Username wajib diisi.'); return; }
    if (mode === 'tambah') {
      if (!guruForm.password.trim()) { setError('Password wajib diisi.'); return; }
      if (guruForm.password.trim().length < 6) { setError('Password minimal 6 karakter.'); return; }
    } else {
      if (guruForm.password.trim() && guruForm.password.trim().length < 6) { setError('Password minimal 6 karakter.'); return; }
    }
    setSavingAkun(true);
    try {
      if (mode === 'tambah') {
        const res = await fetch('/api/akun', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: guruForm.username.trim(), password: guruForm.password, nama: guruForm.nama.trim(), role: 'guru', nip: guruForm.username.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Gagal menyimpan.'); return; }
      } else {
        const patchBody: Record<string, string> = { userId: editId, nama: guruForm.nama.trim() };
        // Hanya kirim password jika diisi — kosong = tidak diubah
        if (guruForm.password.trim()) patchBody.password = guruForm.password.trim();
        const res = await fetch('/api/akun', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error ?? 'Gagal menyimpan.'); return; }
      }
      setGuruForm({ nama: '', username: '', password: '' });
      setToast({ msg: `Guru berhasil ${mode === 'tambah' ? 'ditambahkan' : 'diperbarui'}.`, type: 'success' });
      loadData(); setMode('list');
    } catch {
      setError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setSavingAkun(false);
    }
  }

  async function handleDeleteGuru(id: string) {
    setConfirmMsg('Hapus guru ini? Tindakan tidak bisa dibatalkan.');
    setConfirmAction(() => async () => {
      setDeletingId(id);
      try {
        const res = await fetch(`/api/akun?id=${id}&type=guru`, { method: 'DELETE' });
        if (!res.ok) { setToast({ msg: 'Tidak bisa hapus guru yang memiliki jadwal ujian aktif.', type: 'error' }); return; }
        setToast({ msg: 'Guru berhasil dihapus.', type: 'success' });
        loadData();
      } catch {
        setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
      } finally {
        setDeletingId('');
      }
    });
  }

  function handleResetPassword(userId: string) { setRpTarget(userId); setRpVal(''); }
  async function handleSaveResetPassword() {
    if (!rpVal.trim()) return;
    setSavingRp(true);
    try {
      const res = await fetch('/api/akun', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: rpTarget, password: rpVal.trim() }),
      });
      if (!res.ok) { setToast({ msg: 'Gagal mereset password.', type: 'error' }); return; }
      setRpTarget(''); setRpVal('');
      setToast({ msg: 'Password berhasil direset.', type: 'success' });
    } catch {
      setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
    } finally {
      setSavingRp(false);
    }
  }

  // ── Helpers ────────────────────────────────────────────────
  const kelasMap: Record<string, string> = {};
  kelasList.forEach(k => { kelasMap[k.id] = k.nama_kelas; });

  const inForm = mode === 'tambah' || mode === 'edit';
  const inImport = mode === 'import';

  // ── Sorting & filtering ────────────────────────────────────
  function sortedSiswa() {
    let list = siswaList.filter(s => {
      const u = userMap[s.id_user];
      const kls = kelasMap[s.id_kelas] ?? '';
      const q = search.toLowerCase();
      return s.nama.toLowerCase().includes(q) || kls.toLowerCase().includes(q) || (u?.username ?? '').toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      let va = '', vb = '';
      if (sortKey === 'kelas') { va = kelasMap[a.id_kelas] ?? ''; vb = kelasMap[b.id_kelas] ?? ''; }
      else if (sortKey === 'nama') { va = a.nama; vb = b.nama; }
      else if (sortKey === 'username') { va = userMap[a.id_user]?.username ?? ''; vb = userMap[b.id_user]?.username ?? ''; }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }

  function sortedGuru() {
    let list = guruList.filter(g => {
      const u = userMap[g.id_user];
      const q = search.toLowerCase();
      return g.nama.toLowerCase().includes(q) || (u?.username ?? '').toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      const va = sortKey === 'username' ? (userMap[a.id_user]?.username ?? '') : a.nama;
      const vb = sortKey === 'username' ? (userMap[b.id_user]?.username ?? '') : b.nama;
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return list;
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p);
    else { setSortKey(key); setSortAsc(true); }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return ' ↕';
    return sortAsc ? ' ↑' : ' ↓';
  }

  // ── Import Excel (paste) ───────────────────────────────────
  // Format kolom: Kelas | Nama | Username | Password
  async function handleImportPaste() {
    const lines = importText.trim().split('\n').filter(l => l.trim());
    const errs: string[] = [];
    let ok = 0;
    setImporting(true);
    try {
      for (let idx = 0; idx < lines.length; idx++) {
        const cols = lines[idx].split('\t').map(c => c.trim());
        if (cols.length < 4) { errs.push(`Baris ${idx + 1}: kolom kurang (butuh 4: Kelas, Nama, Username, Password)`); continue; }
        const [namaKelas, nama, username, password] = cols;
        const kelas = kelasList.find(k => k.nama_kelas.toLowerCase() === namaKelas.toLowerCase());
        if (!kelas) { errs.push(`Baris ${idx + 1}: kelas "${namaKelas}" tidak ditemukan`); continue; }
        if (!nama || !username || !password) { errs.push(`Baris ${idx + 1}: nama/username/password tidak boleh kosong`); continue; }
        const nis = username;
        const res = await fetch('/api/akun', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'siswa', nis, nama, id_kelas: kelas.id, username, password }),
        });
        if (!res.ok) {
          const data = await res.json();
          errs.push(`Baris ${idx + 1}: ${data.error ?? 'Gagal menyimpan'}`);
        } else {
          ok++;
        }
      }
      setImportErrors(errs);
      setImportSuccess(ok);
      if (ok > 0) {
        loadData();
        setToast({ msg: `${ok} siswa berhasil diimport.`, type: 'success' });
      }
    } catch {
      setToast({ msg: 'Terjadi kesalahan saat import.', type: 'error' });
    } finally {
      setImporting(false);
    }
  }

  // Format kolom: Nama | Username | Password
  async function handleImportGuruPaste() {
    const lines = importText.trim().split('\n').filter(l => l.trim());
    const errs: string[] = [];
    let ok = 0;
    setImporting(true);
    try {
      for (let idx = 0; idx < lines.length; idx++) {
        const cols = lines[idx].split('\t').map(c => c.trim());
      if (cols.length < 3) { errs.push(`Baris ${idx + 1}: kolom kurang (butuh 3: Nama, Username, Password)`); continue; }
      const [nama, username, password] = cols;
      if (!nama || !username || !password) { errs.push(`Baris ${idx + 1}: nama/username/password tidak boleh kosong`); continue; }
      const res = await fetch('/api/akun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'guru', nip: username, nama, username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        errs.push(`Baris ${idx + 1}: ${data.error ?? 'Gagal menyimpan'}`);
      } else {
        ok++;
      }
    }
    setImportErrors(errs);
    setImportSuccess(ok);
    if (ok > 0) {
      loadData();
      setToast({ msg: `${ok} guru berhasil diimport.`, type: 'success' });
    }
    } catch {
      setToast({ msg: 'Terjadi kesalahan saat import.', type: 'error' });
    } finally {
      setImporting(false);
    }
  }

  function pageTitle() {
    if (inImport && tab === 'guru') return 'Import Guru dari Excel';
    if (inImport) return 'Import Siswa dari Excel';
    if (inForm) return `${mode === 'tambah' ? 'Tambah' : 'Edit'} ${tab === 'siswa' ? 'Siswa' : 'Guru'}`;
    return 'Kelola Akun';
  }

  if (isLoading || !user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <AppTopbar pageLabel="Kelola Akun" />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
            <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-text)' }}>{pageTitle()}</h1>
            <p style={{ margin: '0.125rem 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              {inForm ? 'Isi form di bawah ini' : 'Manajemen akun siswa dan guru'}
            </p>
          </div>
          {inForm && (
            <button className="btn btn-ghost btn-sm" onClick={() => setMode('list')}>← Kembali</button>
          )}
          {inImport && (
            <button className="btn btn-ghost btn-sm" onClick={() => { setMode('list'); setImportText(''); setImportErrors([]); setImportSuccess(0); }}>← Kembali</button>
          )}
          {!inForm && !inImport && tab === 'siswa' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setMode('import'); setImportText(''); setImportErrors([]); setImportSuccess(0); }}>Import Excel</button>
              <button className="btn btn-primary btn-sm" onClick={handleTambahSiswa}>+ Tambah Siswa</button>
            </div>
          )}
          {!inForm && !inImport && tab === 'guru' && (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-outline btn-sm" onClick={() => { setMode('import'); setImportText(''); setImportErrors([]); setImportSuccess(0); }}>Import Excel</button>
              <button className="btn btn-primary btn-sm" onClick={handleTambahGuru}>+ Tambah Guru</button>
            </div>
          )}
        </div>

        <div style={{ padding: '1.5rem' }}>

          {/* Tab switcher */}
          {!inForm && !inImport && (
            <div style={{ display: 'flex', gap: '0', marginBottom: '1.5rem', borderBottom: '2px solid var(--color-border)' }}>
              {(['siswa', 'guru'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setMode('list'); setSearch(''); }}
                  style={{
                    padding: '0.625rem 1.5rem', background: 'none', border: 'none',
                    borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
                    marginBottom: '-2px',
                    color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    fontWeight: tab === t ? 700 : 500, cursor: 'pointer',
                    fontSize: '0.9375rem',
                  }}
                >
                  {t === 'siswa' ? `Siswa (${siswaList.length})` : `Guru (${guruList.length})`}
                </button>
              ))}
            </div>
          )}

          {/* ── IMPORT SISWA ──────────────────────────────────── */}
          {tab === 'siswa' && inImport && (
            <div style={{ maxWidth: 640 }}>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Salin data dari Excel lalu paste di bawah. Format kolom: <strong>Kelas | Nama | Username | Password</strong> (tab-separated, tanpa header).
              </p>
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Kelas yang tersedia: {kelasList.map(k => k.nama_kelas).join(', ')}
              </p>
              <textarea
                className="form-input"
                rows={10}
                style={{ fontFamily: 'monospace', fontSize: '0.8125rem', width: '100%' }}
                placeholder={'9A\tFatimah Az-Zahra\t001\tsiswa123\n9A\tAisyah Putri\t002\tsiswa123'}
                value={importText}
                onChange={e => setImportText(e.target.value)}
              />
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button className="btn btn-primary" onClick={handleImportPaste} disabled={!importText.trim() || importing}>
                  {importing ? 'Memproses...' : 'Proses Import'}
                </button>
                <button className="btn btn-ghost" onClick={() => { setImportText(''); setImportErrors([]); setImportSuccess(0); }}>
                  Bersihkan
                </button>
              </div>
              {importSuccess > 0 && (
                <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', background: 'var(--color-success-subtle)', border: '1px solid var(--color-success)', borderRadius: '0.5rem', color: 'var(--color-success)', fontWeight: 600 }}>
                  {importSuccess} siswa berhasil diimport.
                </div>
              )}
              {importErrors.length > 0 && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', background: 'var(--color-danger-subtle)', border: '1px solid var(--color-danger)', borderRadius: '0.5rem' }}>
                  <div style={{ fontWeight: 700, color: 'var(--color-danger)', marginBottom: '0.5rem' }}>{importErrors.length} baris gagal:</div>
                  {importErrors.map((e, i) => <div key={i} style={{ fontSize: '0.8125rem', color: 'var(--color-danger)' }}>{e}</div>)}
                </div>
              )}
            </div>
          )}

          {/* ── LIST: SISWA ───────────────────────────────────── */}
          {tab === 'siswa' && mode === 'list' && (
            <div>
              {/* Search bar */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  className="form-input"
                  style={{ maxWidth: 320 }}
                  placeholder="Cari nama, kelas, username..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
              {sortedSiswa().length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <p style={{ fontWeight: 600 }}>{search ? 'Tidak ada hasil pencarian.' : 'Belum ada data siswa.'}</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)' }}>
                        {([['kelas', 'Kelas'], ['nama', 'Nama'], ['username', 'Username']] as [SortKey, string][]).map(([key, label]) => (
                          <th key={key} onClick={() => handleSort(key)} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)', cursor: 'pointer', userSelect: 'none' }}>
                            {label}{sortIcon(key)}
                          </th>
                        ))}
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>Password</th>
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSiswa().map((siswa, i, arr) => {
                        const u = userMap[siswa.id_user];
                        return (
                          <tr key={siswa.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <td style={{ padding: '0.75rem 1rem' }}><span className="badge badge-neutral">{kelasMap[siswa.id_kelas] ?? '—'}</span></td>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{siswa.nama}</td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{u?.username ?? '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{u?.password ?? '—'}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-outline btn-sm" onClick={() => handleEditSiswa(siswa)}>Edit</button>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteSiswa(siswa.id)}>Hapus</button>
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
            </div>
          )}

          {/* ── LIST: GURU ────────────────────────────────────── */}
          {tab === 'guru' && mode === 'list' && (
            <div>
              {/* Search bar */}
              <div style={{ marginBottom: '1rem' }}>
                <input
                  className="form-input"
                  style={{ maxWidth: 320 }}
                  placeholder="Cari nama atau username..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
            <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', overflow: 'hidden' }}>
              {sortedGuru().length === 0 ? (
                <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <p style={{ fontWeight: 600 }}>{search ? 'Tidak ada hasil pencarian.' : 'Belum ada data guru.'}</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: 'var(--color-surface-alt)' }}>
                        {([['nama', 'Nama'], ['username', 'Username']] as [SortKey, string][]).map(([key, label]) => (
                          <th key={key} onClick={() => handleSort(key)} style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)', cursor: 'pointer', userSelect: 'none' }}>
                            {label}{sortIcon(key)}
                          </th>
                        ))}
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>Password</th>
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedGuru().map((guru, i, arr) => {
                        const u = userMap[guru.id_user];
                        return (
                          <tr key={guru.id} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, fontSize: '0.875rem', color: 'var(--color-text)' }}>{guru.nama}</td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{u?.username ?? '—'}</td>
                            <td style={{ padding: '0.75rem 1rem', fontFamily: 'monospace', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{u?.password ?? '—'}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                                <button className="btn btn-outline btn-sm" onClick={() => handleEditGuru(guru)}>Edit</button>
                                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={() => handleDeleteGuru(guru.id)}>Hapus</button>
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
            </div>
          )}

          {/* ── FORM: SISWA ───────────────────────────────────── */}
          {tab === 'siswa' && inForm && (
            <div style={{ maxWidth: 560, background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-danger">{error}</div>}
              {[
                { label: 'Nama Lengkap *', key: 'nama',     type: 'text',     placeholder: 'Nama siswa' },
                { label: 'Username *',     key: 'username', type: 'text',     placeholder: 'Username untuk login' },
                { label: mode === 'tambah' ? 'Password *' : 'Password Baru (kosongkan jika tidak diubah)', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type={f.type} placeholder={f.placeholder}
                    value={(siswForm as Record<string, string>)[f.key]}
                    onChange={e => setSiswForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Kelas *</label>
                <CustomSelect
                  value={siswForm.id_kelas}
                  onChange={v => setSiswForm(p => ({ ...p, id_kelas: v }))}
                  options={[
                    { value: '', label: '— Pilih Kelas —' },
                    ...kelasList.map(k => ({ value: k.id, label: k.nama_kelas })),
                  ]}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setMode('list')} disabled={savingAkun}>Batal</button>
                <button className="btn btn-primary" onClick={handleSaveSiswa} disabled={savingAkun}>
                  {savingAkun ? 'Menyimpan...' : mode === 'tambah' ? 'Tambah Siswa' : 'Simpan'}
                </button>
              </div>
            </div>
          )}

          {/* ── FORM: GURU ────────────────────────────────────── */}
          {tab === 'guru' && inForm && (
            <div style={{ maxWidth: 560, background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-danger">{error}</div>}
              {[
                { label: 'Nama Lengkap *', key: 'nama',     type: 'text',     placeholder: 'Nama guru' },
                { label: 'Username *',     key: 'username', type: 'text',     placeholder: 'Username untuk login' },
                { label: mode === 'tambah' ? 'Password *' : 'Password Baru (kosongkan jika tidak diubah)', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type={f.type} placeholder={f.placeholder}
                    value={(guruForm as Record<string, string>)[f.key]}
                    onChange={e => setGuruForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setMode('list')} disabled={savingAkun}>Batal</button>
                <button className="btn btn-primary" onClick={handleSaveGuru} disabled={savingAkun}>
                  {savingAkun ? 'Menyimpan...' : mode === 'tambah' ? 'Tambah Guru' : 'Simpan'}
                </button>
              </div>
            </div>
          )}

          {/* ── IMPORT: GURU ──────────────────────────────────── */}
          {tab === 'guru' && inImport && (
            <div style={{ maxWidth: 640, background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', display: 'grid', gap: '1rem' }}>
              <div className="alert alert-info" style={{ fontSize: '0.875rem' }}>
                Salin data dari Excel lalu paste di bawah.<br />
                Format kolom (tab-separated): <strong>Nama | Username | Password</strong>
              </div>
              <textarea className="form-input form-textarea" rows={10}
                placeholder={'Ahmad Fauzi\tguru.ahmad\tpass123\nBudi Santoso\tguru.budi\tpass456'}
                value={importText} onChange={e => setImportText(e.target.value)} />
              {importSuccess > 0 && (
                <div className="alert alert-success">{importSuccess} guru berhasil diimpor.</div>
              )}
              {importErrors.length > 0 && (
                <div className="alert alert-danger" style={{ fontSize: '0.8125rem' }}>
                  <strong>Terdapat {importErrors.length} error:</strong>
                  <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem' }}>
                    {importErrors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => { setMode('list'); setImportText(''); setImportErrors([]); setImportSuccess(0); }}>Batal</button>
                <button className="btn btn-primary" onClick={handleImportGuruPaste}>Import</button>
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL: RESET PASSWORD ─────────────────────────── */}
        {rpTarget && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', width: 360 }}>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Reset Password</h2>
              <input className="form-input" type="password" placeholder="Password baru" value={rpVal}
                onChange={e => setRpVal(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveResetPassword()} />
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button className="btn btn-ghost" onClick={() => setRpTarget('')} disabled={savingRp}>Batal</button>
                <button className="btn btn-primary" onClick={handleSaveResetPassword} disabled={savingRp}>
                  {savingRp ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONFIRM MODAL ────────────────────────────────────── */}
        {confirmMsg && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }}>
            <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', width: 360 }}>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.9375rem', color: 'var(--color-text)', lineHeight: 1.5 }}>{confirmMsg}</p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => { setConfirmMsg(''); setConfirmAction(null); }} disabled={!!deletingId}>Batal</button>
                <button className="btn btn-danger" onClick={() => { confirmAction?.(); setConfirmMsg(''); }} disabled={!!deletingId}
                  style={{ background: 'var(--color-danger)', color: '#fff', border: 'none' }}>
                  {deletingId ? 'Menghapus...' : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        )}

        <Toast toast={toast} onClose={() => setToast(null)} />
      </main>
      </div>
    </div>
  );
}
