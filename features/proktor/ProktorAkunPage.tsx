'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  getStore, createSiswa, updateSiswa, deleteSiswa,
  createGuru, updateGuru, deleteGuru,
  resetPassword,
} from '@/lib/store';
import type { Siswa, Guru, User, Kelas, MataPelajaran } from '@/types';
import ProktorSidebar from './ProktorSidebar';

type Tab  = 'siswa' | 'guru';
type Mode = 'list' | 'tambah' | 'edit' | 'import';
type SortKey = 'kelas' | 'nama' | 'username';

export default function ProktorAkunPage() {
  const { user } = useAuth();
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
  const [mapelList, setMapelList] = useState<MataPelajaran[]>([]);

  // Forms
  const [siswForm, setSiswForm] = useState({ nis: '', nama: '', id_kelas: '', username: '', password: '' });
  const [guruForm, setGuruForm] = useState({ nip: '', nama: '', mapel_ids: [] as string[], username: '', password: '' });

  // Reset password modal
  const [rpTarget, setRpTarget] = useState('');
  const [rpVal,    setRpVal]    = useState('');

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (user.role !== 'proktor' && user.role !== 'admin') { router.replace('/login'); return; }
    loadData();
  }, [user, router]);

  function loadData() {
    const s = getStore();
    const map: Record<string, User> = {};
    s.users.forEach(u => { map[u.id] = u; });
    setUserMap(map);
    setSiswaList([...s.siswas]);
    setGuruList([...s.gurus]);
    setKelasList([...s.kelas]);
    setMapelList([...s.mataPelajaran]);
  }

  // ── Siswa handlers ─────────────────────────────────────────

  function handleTambahSiswa() {
    setSiswForm({ nis: '', nama: '', id_kelas: '', username: '', password: '' });
    setEditId(''); setError(''); setMode('tambah');
  }

  function handleEditSiswa(siswa: Siswa) {
    const u = userMap[siswa.id_user];
    setSiswForm({ nis: siswa.nis, nama: siswa.nama, id_kelas: siswa.id_kelas, username: u?.username ?? '', password: '' });
    setEditId(siswa.id); setError(''); setMode('edit');
  }

  function handleSaveSiswa() {
    setError('');
    const s = getStore();
    if (!siswForm.nis.trim())      { setError('NIS wajib diisi.'); return; }
    if (!siswForm.nama.trim())     { setError('Nama wajib diisi.'); return; }
    if (!siswForm.id_kelas)        { setError('Kelas wajib dipilih.'); return; }
    if (!siswForm.username.trim()) { setError('Username wajib diisi.'); return; }
    if (mode === 'tambah') {
      if (!siswForm.password.trim()) { setError('Password wajib diisi.'); return; }
      if (s.siswas.some(x => x.nis === siswForm.nis.trim())) { setError('NIS sudah terdaftar.'); return; }
      if (s.users.some(x => x.username === siswForm.username.trim())) { setError('Username sudah dipakai.'); return; }
      createSiswa({ nis: siswForm.nis.trim(), nama: siswForm.nama.trim(), id_kelas: siswForm.id_kelas, username: siswForm.username.trim(), password: siswForm.password });
    } else {
      updateSiswa(editId, { nis: siswForm.nis.trim(), nama: siswForm.nama.trim(), id_kelas: siswForm.id_kelas });
      if (siswForm.password.trim()) resetPassword(s.siswas.find(x => x.id === editId)!.id_user, siswForm.password);
    }
    loadData(); setMode('list');
  }

  function handleDeleteSiswa(id: string) {
    if (!window.confirm('Hapus siswa ini? Tindakan tidak bisa dibatalkan.')) return;
    deleteSiswa(id); loadData();
  }

  // ── Guru handlers ──────────────────────────────────────────

  function handleTambahGuru() {
    setGuruForm({ nip: '', nama: '', mapel_ids: [], username: '', password: '' });
    setEditId(''); setError(''); setMode('tambah');
  }

  function handleEditGuru(guru: Guru) {
    const u = userMap[guru.id_user];
    setGuruForm({ nip: guru.nip, nama: guru.nama, mapel_ids: [...guru.mapel_ids], username: u?.username ?? '', password: '' });
    setEditId(guru.id); setError(''); setMode('edit');
  }

  function handleSaveGuru() {
    setError('');
    const s = getStore();
    if (!guruForm.nip.trim())      { setError('NIP wajib diisi.'); return; }
    if (!guruForm.nama.trim())     { setError('Nama wajib diisi.'); return; }
    if (!guruForm.username.trim()) { setError('Username wajib diisi.'); return; }
    if (guruForm.mapel_ids.length === 0) { setError('Pilih minimal 1 mata pelajaran.'); return; }
    if (mode === 'tambah') {
      if (!guruForm.password.trim()) { setError('Password wajib diisi.'); return; }
      if (s.gurus.some(x => x.nip === guruForm.nip.trim())) { setError('NIP sudah terdaftar.'); return; }
      if (s.users.some(x => x.username === guruForm.username.trim())) { setError('Username sudah dipakai.'); return; }
      createGuru({ nip: guruForm.nip.trim(), nama: guruForm.nama.trim(), mapel_ids: guruForm.mapel_ids, username: guruForm.username.trim(), password: guruForm.password });
    } else {
      updateGuru(editId, { nip: guruForm.nip.trim(), nama: guruForm.nama.trim(), mapel_ids: guruForm.mapel_ids });
      if (guruForm.password.trim()) {
        const g = s.gurus.find(x => x.id === editId);
        if (g) resetPassword(g.id_user, guruForm.password);
      }
    }
    loadData(); setMode('list');
  }

  function handleDeleteGuru(id: string) {
    if (!window.confirm('Hapus guru ini?')) return;
    const ok = deleteGuru(id);
    if (!ok) { alert('Tidak bisa hapus guru yang memiliki jadwal ujian aktif.'); return; }
    loadData();
  }

  function handleResetPassword(userId: string) { setRpTarget(userId); setRpVal(''); }
  function handleSaveResetPassword() {
    if (!rpVal.trim()) return;
    resetPassword(rpTarget, rpVal.trim());
    setRpTarget(''); setRpVal('');
    alert('Password berhasil direset.');
  }

  // ── Helpers ────────────────────────────────────────────────
  const kelasMap: Record<string, string> = {};
  kelasList.forEach(k => { kelasMap[k.id] = k.nama_kelas; });
  const mapelMap: Record<string, string> = {};
  mapelList.forEach(m => { mapelMap[m.id] = m.nama_mapel; });

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
  function handleImportPaste() {
    const lines = importText.trim().split('\n').filter(l => l.trim());
    const errs: string[] = [];
    let ok = 0;
    const s = getStore();
    lines.forEach((line, idx) => {
      const cols = line.split('\t').map(c => c.trim());
      if (cols.length < 4) { errs.push(`Baris ${idx + 1}: kolom kurang (butuh 4: Kelas, Nama, Username, Password)`); return; }
      const [namaKelas, nama, username, password] = cols;
      const kelas = kelasList.find(k => k.nama_kelas.toLowerCase() === namaKelas.toLowerCase());
      if (!kelas) { errs.push(`Baris ${idx + 1}: kelas "${namaKelas}" tidak ditemukan`); return; }
      if (!nama || !username || !password) { errs.push(`Baris ${idx + 1}: nama/username/password tidak boleh kosong`); return; }
      if (s.users.some(u => u.username === username)) { errs.push(`Baris ${idx + 1}: username "${username}" sudah dipakai`); return; }
      const nis = username; // gunakan username sebagai NIS jika tidak ada kolom NIS
      createSiswa({ nis, nama, id_kelas: kelas.id, username, password });
      ok++;
    });
    setImportErrors(errs);
    setImportSuccess(ok);
    if (ok > 0) loadData();
  }

  function pageTitle() {
    if (inImport) return 'Import Siswa dari Excel';
    if (inForm) return `${mode === 'tambah' ? 'Tambah' : 'Edit'} ${tab === 'siswa' ? 'Siswa' : 'Guru'}`;
    return 'Kelola Akun';
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
            <button className="btn btn-primary btn-sm" onClick={handleTambahGuru}>+ Tambah Guru</button>
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
          {inImport && (
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
                <button className="btn btn-primary" onClick={handleImportPaste} disabled={!importText.trim()}>
                  Proses Import
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
                        <th style={{ padding: '0.625rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '2px solid var(--color-border)' }}>Mapel</th>
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
                                {guru.mapel_ids.map(mid => (
                                  <span key={mid} className="badge badge-neutral" style={{ fontSize: '0.7rem' }}>{mapelMap[mid] ?? mid}</span>
                                ))}
                              </div>
                            </td>
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
                { label: 'NIS *',      key: 'nis',      type: 'text',     placeholder: 'Contoh: 20250001' },
                { label: 'Nama Lengkap *', key: 'nama', type: 'text',     placeholder: 'Nama siswa' },
                { label: 'Username *', key: 'username', type: 'text',     placeholder: 'Username untuk login' },
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
                <select className="form-select" value={siswForm.id_kelas} onChange={e => setSiswForm(p => ({ ...p, id_kelas: e.target.value }))}>
                  <option value="">— Pilih Kelas —</option>
                  {kelasList.map(k => <option key={k.id} value={k.id}>{k.nama_kelas}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setMode('list')}>Batal</button>
                <button className="btn btn-primary" onClick={handleSaveSiswa}>
                  {mode === 'tambah' ? 'Tambah Siswa' : 'Simpan'}
                </button>
              </div>
            </div>
          )}

          {/* ── FORM: GURU ────────────────────────────────────── */}
          {tab === 'guru' && inForm && (
            <div style={{ maxWidth: 600, background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', display: 'grid', gap: '1rem' }}>
              {error && <div className="alert alert-danger">{error}</div>}
              {[
                { label: 'NIP *',      key: 'nip',      type: 'text',     placeholder: 'Nomor Induk Pegawai' },
                { label: 'Nama Lengkap *', key: 'nama', type: 'text',     placeholder: 'Nama guru' },
                { label: 'Username *', key: 'username', type: 'text',     placeholder: 'Username untuk login' },
                { label: mode === 'tambah' ? 'Password *' : 'Password Baru (kosongkan jika tidak diubah)', key: 'password', type: 'password', placeholder: '••••••••' },
              ].map(f => (
                <div key={f.key} className="form-group">
                  <label className="form-label">{f.label}</label>
                  <input className="form-input" type={f.type} placeholder={f.placeholder}
                    value={(guruForm as unknown as Record<string, string>)[f.key]}
                    onChange={e => setGuruForm(p => ({ ...p, [f.key]: e.target.value }))} />
                </div>
              ))}
              <div className="form-group">
                <label className="form-label">Mata Pelajaran yang Diampu *</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.375rem' }}>
                  {mapelList.map(m => {
                    const checked = guruForm.mapel_ids.includes(m.id);
                    return (
                      <label key={m.id} style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.375rem 0.625rem', borderRadius: '0.5rem',
                        background: checked ? 'var(--color-primary-subtle)' : 'var(--color-surface-alt)',
                        border: `1px solid ${checked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                        cursor: 'pointer', fontSize: '0.8125rem',
                      }}>
                        <input type="checkbox" checked={checked} style={{ accentColor: 'var(--color-primary)' }}
                          onChange={() => setGuruForm(p => ({
                            ...p,
                            mapel_ids: checked ? p.mapel_ids.filter(id => id !== m.id) : [...p.mapel_ids, m.id],
                          }))} />
                        {m.nama_mapel}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setMode('list')}>Batal</button>
                <button className="btn btn-primary" onClick={handleSaveGuru}>
                  {mode === 'tambah' ? 'Tambah Guru' : 'Simpan'}
                </button>
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
                <button className="btn btn-ghost" onClick={() => setRpTarget('')}>Batal</button>
                <button className="btn btn-primary" onClick={handleSaveResetPassword}>Simpan</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
