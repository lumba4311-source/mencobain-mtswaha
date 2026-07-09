'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { getStore } from '@/lib/store';
import type { Soal, Ujian, JawabanBenar } from '@/types';

type Tab = 'tambah' | 'massal';

const OPSI_KEYS: JawabanBenar[] = ['A', 'B', 'C', 'D', 'E'];

const emptySoal = (): Omit<Soal, 'id' | 'id_ujian' | 'nomor'> => ({
  pertanyaan: '',
  opsi_a: '', opsi_b: '', opsi_c: '', opsi_d: '', opsi_e: '',
  jawaban_benar: 'A',
  bobot: 1,
});

export default function InputSoalPage() {
  const { user, guru } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ujianId = searchParams.get('ujian') ?? '';

  const [ujian, setUjian] = useState<Ujian | null>(null);
  const [soalList, setSoalList] = useState<Soal[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('tambah');
  const [form, setForm] = useState(emptySoal());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [massalDraft, setMassalDraft] = useState<Soal[]>([]);

  useEffect(() => {
    if (!user || user.role !== 'guru' || !guru) { router.replace('/login'); return; }
    const store = getStore();
    const found = store.ujians.find(u => u.id === ujianId && u.id_guru === guru.id);
    if (!found) { router.replace('/guru/dashboard'); return; }
    setUjian(found);
    const soals = store.soals.filter(s => s.id_ujian === ujianId).sort((a, b) => a.nomor - b.nomor);
    setSoalList(soals);
    setMassalDraft(soals.map(s => ({ ...s })));
  }, [user, guru, ujianId, router]);

  if (!user || !guru || !ujian) return null;

  // ── Tab Tambah ──────────────────────────────────────────────

  function handleFormChange(field: string, value: string | number) {
    setForm(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function handleSaveSoal() {
    const store = getStore();
    if (!form.pertanyaan.trim()) { alert('Pertanyaan wajib diisi.'); return; }
    const opsiRequired = ['opsi_a','opsi_b','opsi_c','opsi_d','opsi_e'] as const;
    for (const key of opsiRequired) {
      if (!form[key].trim()) { alert(`Opsi ${key.split('_')[1].toUpperCase()} wajib diisi.`); return; }
    }

    if (editingId) {
      const idx = store.soals.findIndex(s => s.id === editingId);
      if (idx !== -1) {
        store.soals[idx] = { ...store.soals[idx], ...form };
        const updated = store.soals.filter(s => s.id_ujian === ujianId).sort((a, b) => a.nomor - b.nomor);
        setSoalList([...updated]);
        setMassalDraft([...updated]);
      }
      setEditingId(null);
    } else {
      const nomor = soalList.length + 1;
      const newSoal: Soal = {
        id: `sq_${Date.now()}`,
        id_ujian: ujianId,
        nomor,
        ...form,
      };
      store.soals.push(newSoal);
      setSoalList(prev => [...prev, newSoal]);
      setMassalDraft(prev => [...prev, { ...newSoal }]);
    }

    setForm(emptySoal());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleEdit(soal: Soal) {
    setEditingId(soal.id);
    setForm({
      pertanyaan: soal.pertanyaan,
      opsi_a: soal.opsi_a, opsi_b: soal.opsi_b,
      opsi_c: soal.opsi_c, opsi_d: soal.opsi_d, opsi_e: soal.opsi_e,
      jawaban_benar: soal.jawaban_benar,
      bobot: soal.bobot,
    });
    setActiveTab('tambah');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleDelete(soalId: string) {
    if (!confirm('Hapus soal ini?')) return;
    const store = getStore();
    const idx = store.soals.findIndex(s => s.id === soalId);
    if (idx !== -1) store.soals.splice(idx, 1);
    // Re-number
    store.soals.filter(s => s.id_ujian === ujianId).forEach((s, i) => { s.nomor = i + 1; });
    const updated = store.soals.filter(s => s.id_ujian === ujianId).sort((a, b) => a.nomor - b.nomor);
    setSoalList([...updated]);
    setMassalDraft([...updated]);
  }

  // ── Tab Massal ──────────────────────────────────────────────

  function handleMassalChange(idx: number, field: string, value: string | number) {
    setMassalDraft(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  }

  function handleSaveMassal() {
    const store = getStore();
    massalDraft.forEach(draft => {
      const idx = store.soals.findIndex(s => s.id === draft.id);
      if (idx !== -1) store.soals[idx] = { ...draft };
    });
    setSoalList([...massalDraft]);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1, minWidth: 0 }}>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={() => router.back()} aria-label="Kembali">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {ujian.nama_ujian}
          </span>
          <span className="badge badge-info" style={{ flexShrink: 0 }}>{ujian.jenis_ujian}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {saved && <span className="badge badge-success">Tersimpan</span>}
          <ThemeToggle />
        </div>
      </header>

      <main className="page-container" style={{ paddingTop: '1.5rem' }}>
        {/* Info ujian */}
        <div className="card card-raised" style={{ marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          <span>Durasi: <strong style={{ color: 'var(--color-text)' }}>{ujian.durasi} menit</strong></span>
          <span>KKM: <strong style={{ color: 'var(--color-text)' }}>{ujian.nilai_kkm}</strong></span>
          <span>Total Soal: <strong style={{ color: 'var(--color-primary)' }}>{soalList.length}</strong></span>
          <span>Acak Soal: <strong>{ujian.acak_soal ? 'Ya' : 'Tidak'}</strong></span>
          <span>Acak Opsi: <strong>{ujian.acak_opsi ? 'Ya' : 'Tidak'}</strong></span>
        </div>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: '1.5rem' }}>
          {(['tambah', 'massal'] as Tab[]).map(t => (
            <button key={t} className={`tab-item${activeTab === t ? ' active' : ''}`} onClick={() => setActiveTab(t)}>
              {t === 'tambah' ? 'Input Satu Per Satu' : 'Edit Massal (Spreadsheet)'}
            </button>
          ))}
        </div>

        {/* Tab: Tambah */}
        {activeTab === 'tambah' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            {/* Form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                {editingId ? 'Edit Soal' : 'Tambah Soal Baru'}
              </h3>

              <div className="form-group">
                <label className="form-label">Pertanyaan *</label>
                <textarea
                  className="form-input form-textarea"
                  placeholder="Tulis pertanyaan di sini..."
                  value={form.pertanyaan}
                  onChange={e => handleFormChange('pertanyaan', e.target.value)}
                  rows={4}
                />
              </div>

              {OPSI_KEYS.map(key => {
                const field = `opsi_${key.toLowerCase()}` as keyof typeof form;
                return (
                  <div className="form-group" key={key}>
                    <label className="form-label">Opsi {key} *</label>
                    <input
                      className="form-input"
                      type="text"
                      placeholder={`Isi opsi ${key}`}
                      value={form[field] as string}
                      onChange={e => handleFormChange(field, e.target.value)}
                    />
                  </div>
                );
              })}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">Jawaban Benar *</label>
                  <select
                    className="form-input form-select"
                    value={form.jawaban_benar}
                    onChange={e => handleFormChange('jawaban_benar', e.target.value as JawabanBenar)}
                  >
                    {OPSI_KEYS.map(k => <option key={k} value={k}>Opsi {k}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Bobot Nilai</label>
                  <input
                    className="form-input"
                    type="number"
                    min={1} max={10}
                    value={form.bobot}
                    onChange={e => handleFormChange('bobot', Number(e.target.value))}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn btn-primary" onClick={handleSaveSoal} style={{ flex: 1 }}>
                  {editingId ? 'Simpan Perubahan' : 'Tambah Soal'}
                </button>
                {editingId && (
                  <button className="btn btn-ghost" onClick={() => { setEditingId(null); setForm(emptySoal()); }}>
                    Batal
                  </button>
                )}
              </div>
            </div>

            {/* Daftar soal */}
            <div>
              <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Daftar Soal ({soalList.length})
              </h3>
              {soalList.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                  Belum ada soal. Tambahkan soal di form sebelah kiri.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '70vh', overflowY: 'auto' }}>
                  {soalList.map((soal, idx) => (
                    <div key={soal.id} className="card" style={{ padding: '0.875rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-primary)' }}>#{idx + 1}</span>
                          <p style={{ margin: '0.25rem 0 0.5rem', fontSize: '0.875rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                            {soal.pertanyaan.length > 100 ? soal.pertanyaan.slice(0, 100) + '...' : soal.pertanyaan}
                          </p>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span className="badge badge-success">Jwb: {soal.jawaban_benar}</span>
                            <span className="badge badge-neutral">Bobot: {soal.bobot}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
                          <button className="btn btn-outline btn-sm" onClick={() => handleEdit(soal)}>Edit</button>
                          <button className="btn btn-danger btn-sm" onClick={() => handleDelete(soal.id)}>Hapus</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab: Massal */}
        {activeTab === 'massal' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Edit langsung di tabel. Klik "Simpan Semua" setelah selesai.
              </p>
              <button className="btn btn-primary btn-sm" onClick={handleSaveMassal}>
                Simpan Semua ({massalDraft.length} soal)
              </button>
            </div>

            {massalDraft.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                Belum ada soal. Tambahkan via tab "Input Satu Per Satu" terlebih dahulu.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-surface-raised)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '0.625rem 0.5rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, minWidth: 32 }}>#</th>
                      <th style={{ padding: '0.625rem 0.5rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, minWidth: 280 }}>Pertanyaan</th>
                      {OPSI_KEYS.map(k => (
                        <th key={k} style={{ padding: '0.625rem 0.5rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, minWidth: 140 }}>
                          Opsi {k}
                        </th>
                      ))}
                      <th style={{ padding: '0.625rem 0.5rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, minWidth: 90 }}>Jwb Benar</th>
                      <th style={{ padding: '0.625rem 0.5rem', textAlign: 'left', color: 'var(--color-text-muted)', fontWeight: 600, minWidth: 70 }}>Bobot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {massalDraft.map((soal, idx) => (
                      <tr key={soal.id} style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                        <td style={{ padding: '0.375rem 0.5rem', color: 'var(--color-text-muted)', fontWeight: 700 }}>{idx + 1}</td>
                        <td style={{ padding: '0.375rem 0.5rem' }}>
                          <textarea
                            className="form-input form-textarea"
                            value={soal.pertanyaan}
                            onChange={e => handleMassalChange(idx, 'pertanyaan', e.target.value)}
                            rows={2}
                            style={{ minHeight: 56, fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                          />
                        </td>
                        {OPSI_KEYS.map(k => {
                          const field = `opsi_${k.toLowerCase()}` as keyof Soal;
                          return (
                            <td key={k} style={{ padding: '0.375rem 0.5rem' }}>
                              <input
                                className="form-input"
                                type="text"
                                value={soal[field] as string}
                                onChange={e => handleMassalChange(idx, field, e.target.value)}
                                style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                              />
                            </td>
                          );
                        })}
                        <td style={{ padding: '0.375rem 0.5rem' }}>
                          <select
                            className="form-input form-select"
                            value={soal.jawaban_benar}
                            onChange={e => handleMassalChange(idx, 'jawaban_benar', e.target.value)}
                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                          >
                            {OPSI_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '0.375rem 0.5rem' }}>
                          <input
                            className="form-input"
                            type="number"
                            min={1} max={10}
                            value={soal.bobot}
                            onChange={e => handleMassalChange(idx, 'bobot', Number(e.target.value))}
                            style={{ fontSize: '0.8125rem', padding: '0.375rem 0.5rem' }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
