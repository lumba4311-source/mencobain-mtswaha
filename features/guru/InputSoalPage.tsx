'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { createSupabaseBrowserClient } from '@/lib/supabase';
import type { Soal, Ujian } from '@/types';
import AppTopbar from '@/components/AppTopbar';
import Toast, { type ToastData } from '@/components/Toast';

type OpsiKey = 'opsi_a' | 'opsi_b' | 'opsi_c' | 'opsi_d';
type JawabanABCD = 'A' | 'B' | 'C' | 'D';

const OPSI_LIST: { key: OpsiKey; label: JawabanABCD }[] = [
  { key: 'opsi_a', label: 'A' },
  { key: 'opsi_b', label: 'B' },
  { key: 'opsi_c', label: 'C' },
  { key: 'opsi_d', label: 'D' },
];

const emptyForm = () => ({
  pertanyaan: '',
  opsi_a: '', opsi_b: '', opsi_c: '', opsi_d: '',
  jawaban_benar: 'A' as JawabanABCD,
  gambar_url: '',
});

type FormState = ReturnType<typeof emptyForm>;

export default function InputSoalPage() {
  const { user, guru, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ujianId = searchParams.get('ujian') ?? '';

  const [ujian, setUjian] = useState<Ujian | null>(null);
  const [soalList, setSoalList] = useState<Soal[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');
  const [saved, setSaved] = useState(false);
  const [namaUjian, setNamaUjian] = useState('');
  const [editingNama, setEditingNama] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [savingForm, setSavingForm] = useState(false);
  const [savingNama, setSavingNama] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState('');
  const [toast, setToast] = useState<ToastData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // reset input so same file can be re-selected
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFormError('File harus berupa gambar.'); return; }
    if (file.size > 10 * 1024 * 1024) { setFormError('Ukuran gambar maksimal 10MB.'); return; }

    setFormError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', ujianId || 'misc');

      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const json = await res.json();

      if (!res.ok) {
        setFormError(json.error ?? 'Gagal upload gambar.');
        return;
      }

      handleFormChange('gambar_url', json.url);
    } catch (err) {
      setFormError('Terjadi kesalahan saat upload gambar.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'guru' || !guru) { router.replace('/login'); return; }
    fetch(`/api/ujian/${ujianId}`)
      .then(r => r.json())
      .then(found => {
        if (!found || found.id_guru !== guru.id) { router.replace('/guru/dashboard'); return; }
        setUjian(found);
        setNamaUjian(found.nama_ujian);
        reload();
      })
      .catch(() => router.replace('/guru/dashboard'));
  }, [isLoading, user, guru, ujianId, router]);

  function reload() {
    fetch(`/api/soal/${ujianId}`)
      .then(r => r.json())
      .then(soals => setSoalList(soals ?? []))
      .catch(console.error);
  }

  if (isLoading || !user || !guru || !ujian) return null;

  // bobot otomatis: 100 / total soal (dihitung saat submit ujian, bukan disimpan)
  const bobotPerSoal = soalList.length > 0 ? Math.round((100 / soalList.length) * 100) / 100 : 0;

  function handleFormChange(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    setFormError('');
    setSaved(false);
  }

  function validateForm(): string {
    if (!form.pertanyaan.trim()) return 'Pertanyaan wajib diisi.';
    if (!form.opsi_a.trim()) return 'Opsi A wajib diisi.';
    if (!form.opsi_b.trim()) return 'Opsi B wajib diisi.';
    if (!form.opsi_c.trim()) return 'Opsi C wajib diisi.';
    if (!form.opsi_d.trim()) return 'Opsi D wajib diisi.';
    return '';
  }

  async function handleSave() {
    // D-05: jangan submit saat gambar masih diupload
    if (uploading) { setFormError('Tunggu upload gambar selesai sebelum menyimpan.'); return; }
    const err = validateForm();
    if (err) { setFormError(err); return; }

    const soalData = {
      pertanyaan: form.pertanyaan.trim(),
      opsi_a: form.opsi_a.trim(),
      opsi_b: form.opsi_b.trim(),
      opsi_c: form.opsi_c.trim(),
      opsi_d: form.opsi_d.trim(),
      jawaban_benar: form.jawaban_benar,
      gambar_url: form.gambar_url.trim() || null,
      bobot: 1,
    };

    setSavingForm(true);
    try {
      if (editingId) {
        const updated = soalList.map(s =>
          s.id === editingId ? { ...s, ...soalData } : s
        );
        const res = await fetch(`/api/soal/${ujianId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ soals: updated }),
        });
        if (!res.ok) { setToast({ msg: 'Gagal menyimpan soal.', type: 'error' }); return; }
        setEditingId(null);
        setToast({ msg: 'Soal berhasil diperbarui.', type: 'success' });
      } else {
        const nomor = soalList.length + 1;
        const res = await fetch(`/api/soal/${ujianId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ soals: [...soalList, { ...soalData, nomor }] }),
        });
        if (!res.ok) { setToast({ msg: 'Gagal menambah soal.', type: 'error' }); return; }
        setToast({ msg: 'Soal berhasil ditambahkan.', type: 'success' });
      }
      setForm(emptyForm());
      setSaved(true);
      reload();
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
    } finally {
      setSavingForm(false);
    }
  }

  async function handleDelete(id: string) {
    setConfirmDeleteId(id);
  }

  async function doDelete(id: string) {
    setConfirmDeleteId('');
    setDeletingId(id);
    try {
      const remaining = soalList
        .filter(s => s.id !== id)
        .map((s, i) => ({ ...s, nomor: i + 1 }));
      const res = await fetch(`/api/soal/${ujianId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soals: remaining }),
      });
      if (!res.ok) { setToast({ msg: 'Gagal menghapus soal.', type: 'error' }); return; }
      setToast({ msg: 'Soal berhasil dihapus.', type: 'success' });
      reload();
    } catch {
      setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
    } finally {
      setDeletingId('');
    }
  }

  function handleEdit(soal: Soal) {
    setEditingId(soal.id);
    setForm({
      pertanyaan: soal.pertanyaan,
      opsi_a: soal.opsi_a,
      opsi_b: soal.opsi_b,
      opsi_c: soal.opsi_c,
      opsi_d: soal.opsi_d,
      jawaban_benar: soal.jawaban_benar as JawabanABCD,
      gambar_url: soal.gambar_url ?? '',
    });
    setFormError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(emptyForm());
    setFormError('');
  }

  async function handleSaveNama() {
    if (!namaUjian.trim()) return;
    setSavingNama(true);
    try {
      const res = await fetch(`/api/ujian/${ujianId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama_ujian: namaUjian.trim() }),
      });
      if (!res.ok) { setToast({ msg: 'Gagal menyimpan nama ujian.', type: 'error' }); return; }
      setUjian(prev => prev ? { ...prev, nama_ujian: namaUjian.trim() } : prev);
      setEditingNama(false);
      setToast({ msg: 'Nama ujian berhasil diperbarui.', type: 'success' });
    } catch {
      setToast({ msg: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
    } finally {
      setSavingNama(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <AppTopbar pageLabel="Kelola Soal" />

      <main style={{ flex: 1, maxWidth: 860, width: '100%', margin: '0 auto', padding: '24px 16px' }}>

        {/* ── Ujian header card ── */}
        <div style={{
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Link href="/guru/dashboard" style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', fontWeight: 500, textDecoration: 'none' }}>
                Dashboard
              </Link>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-subtle)' }}>
                <polyline points="9,18 15,12 9,6"/>
              </svg>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-secondary)', fontWeight: 600 }}>Kelola Soal</span>
            </div>
            {editingNama ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="form-input"
                  value={namaUjian}
                  onChange={e => setNamaUjian(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveNama(); if (e.key === 'Escape') setEditingNama(false); }}
                  autoFocus
                  style={{ fontSize: '1rem', fontWeight: 700, flex: 1 }}
                />
                <button className="btn btn-primary btn-sm" onClick={handleSaveNama}>Simpan</button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditingNama(false); setNamaUjian(ujian.nama_ujian); }}>Batal</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.3 }}>
                  {ujian.nama_ujian}
                </h1>
                <button
                  title="Edit nama ujian"
                  onClick={() => setEditingNama(true)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-subtle)', padding: 2, display: 'flex', alignItems: 'center' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
            )}
            <div style={{ marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                {soalList.length} soal
              </span>
              {soalList.length > 0 && (
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  Bobot per soal: {bobotPerSoal} poin
                </span>
              )}
              <span style={{ fontSize: '0.75rem', color: 'var(--color-secondary)', fontWeight: 500 }}>
                Acak soal & jawaban aktif
              </span>
            </div>
          </div>
          <Link href="/guru/dashboard" className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }}>
            Selesai
          </Link>
        </div>

        {/* ── Add / Edit soal form ── */}
        <div style={{
          background: 'var(--color-surface)',
          border: editingId ? '2px solid var(--color-secondary)' : '1px solid var(--color-border)',
          borderRadius: 12,
          padding: '20px',
          marginBottom: 24,
        }}>
          <div style={{
            fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em',
            textTransform: 'uppercase', color: 'var(--color-text-subtle)', marginBottom: 14,
          }}>
            {editingId ? `Edit Soal` : `Tambah Soal Baru`}
          </div>

          {/* Gambar soal — file picker, di atas pertanyaan */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
              Gambar Soal <span style={{ fontSize: '0.75rem', fontWeight: 400, color: 'var(--color-text-muted)' }}>(opsional)</span>
            </label>

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            {uploading ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '14px 16px',
                border: '2px dashed var(--color-border)',
                borderRadius: 8, background: 'var(--color-surface-raised)',
                color: 'var(--color-text-muted)', fontSize: '0.875rem',
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                <span>Mengupload gambar...</span>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : form.gambar_url ? (
              <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                <img
                  src={form.gambar_url}
                  alt="Preview soal"
                  style={{
                    display: 'block', maxWidth: '100%', maxHeight: 220,
                    objectFit: 'contain', borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-raised)',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    Ganti Gambar
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-danger)' }}
                    onClick={() => handleFormChange('gambar_url', '')}
                    disabled={uploading}
                  >
                    Hapus Gambar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '14px 16px',
                  border: '2px dashed var(--color-border)',
                  borderRadius: 8, background: 'var(--color-surface-raised)',
                  color: 'var(--color-text-muted)', cursor: 'pointer',
                  fontSize: '0.875rem', fontFamily: 'inherit',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-secondary)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-primary-subtle)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-raised)';
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
                <span>Klik untuk upload gambar <span style={{ color: 'var(--color-text-subtle)', fontSize: '0.8125rem' }}>(JPG, PNG, GIF — maks. 10MB)</span></span>
              </button>
            )}
          </div>

          {/* Pertanyaan */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: 6 }}>
              Pertanyaan <span style={{ color: 'var(--color-danger)' }}>*</span>
            </label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Tulis pertanyaan di sini..."
              value={form.pertanyaan}
              onChange={e => handleFormChange('pertanyaan', e.target.value)}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          {/* Opsi A-D dengan checkbox jawaban benar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              {OPSI_LIST.map(({ key, label }) => {
                const isBenar = form.jawaban_benar === label;
                return (
                  <div
                    key={key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 12px',
                      background: isBenar ? 'var(--color-success-bg)' : 'var(--color-surface-raised)',
                      border: isBenar ? '1.5px solid var(--color-success)' : '1px solid var(--color-border)',
                      borderRadius: 8,
                      transition: 'background 0.12s, border-color 0.12s',
                    }}
                  >
                    {/* Checkbox jawaban benar */}
                    <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', flexShrink: 0, marginTop: 1 }}>
                      <input
                        type="radio"
                        name={`jawaban_benar_${editingId ?? 'new'}`}
                        checked={isBenar}
                        onChange={() => handleFormChange('jawaban_benar', label)}
                        style={{ accentColor: 'var(--color-success)', width: 15, height: 15, cursor: 'pointer' }}
                      />
                      <span style={{
                        fontSize: '0.8125rem', fontWeight: 700,
                        color: isBenar ? 'var(--color-success)' : 'var(--color-text-subtle)',
                        minWidth: 16,
                      }}>
                        {label}
                      </span>
                    </label>
                    {/* Input teks opsi */}
                    <input
                      className="form-input"
                      type="text"
                      placeholder={`Opsi ${label}`}
                      value={form[key]}
                      onChange={e => handleFormChange(key, e.target.value)}
                      style={{
                        flex: 1,
                        background: 'transparent',
                        border: 'none',
                        boxShadow: 'none',
                        padding: '0',
                        fontSize: '0.875rem',
                      }}
                    />
                    {isBenar && (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }}>
                        Jawaban benar
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {formError && (
            <div style={{
              padding: '9px 13px', marginBottom: 12,
              background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger-border)',
              borderRadius: 8, fontSize: '0.8125rem', color: 'var(--color-danger)', fontWeight: 500,
            }}>
              {formError}
            </div>
          )}

          {/* Saved feedback */}
          {saved && (
            <div style={{
              padding: '9px 13px', marginBottom: 12,
              background: 'var(--color-success-bg)', border: '1px solid var(--color-success)',
              borderRadius: 8, fontSize: '0.8125rem', color: 'var(--color-success)', fontWeight: 500,
            }}>
              Soal berhasil disimpan.
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {editingId && (
              <button className="btn btn-ghost" onClick={handleCancelEdit} disabled={savingForm}>
                Batal Edit
              </button>
            )}
            <button className="btn btn-primary" onClick={handleSave} disabled={savingForm || uploading}>
              {savingForm ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Soal'}
            </button>
          </div>
        </div>

        {/* ── Soal list as cards ── */}
        {soalList.length === 0 ? (
          <div style={{
            background: 'var(--color-surface)', border: '1px dashed var(--color-border)',
            borderRadius: 12, padding: '40px 24px', textAlign: 'center',
            color: 'var(--color-text-muted)', fontSize: '0.875rem',
          }}>
            Belum ada soal. Tambahkan soal pertama di atas.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: 'var(--color-text-subtle)',
              marginBottom: 4,
            }}>
              Daftar Soal ({soalList.length})
            </div>
            {soalList.map((soal, idx) => (
              <div
                key={soal.id}
                style={{
                  background: 'var(--color-surface)',
                  border: editingId === soal.id ? '2px solid var(--color-secondary)' : '1px solid var(--color-border)',
                  borderRadius: 12,
                  padding: '16px 18px',
                  transition: 'border-color 0.15s',
                }}
              >
                {/* Card header */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                    <span style={{
                      width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                      background: 'var(--color-primary)',
                      color: 'var(--color-text-inverse)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6875rem', fontWeight: 700,
                    }}>
                      {idx + 1}
                    </span>
                    <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500, color: 'var(--color-text)', lineHeight: 1.5 }}>
                      {soal.pertanyaan}
                    </p>
                  </div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      title="Edit soal"
                      onClick={() => handleEdit(soal)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'none',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-subtle)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-raised)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-subtle)'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                    <button
                      title="Hapus soal"
                      onClick={() => handleDelete(soal.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 6,
                        background: 'none',
                        border: '1px solid var(--color-border)',
                        color: 'var(--color-text-subtle)', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'background 0.12s, color 0.12s',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-danger-bg)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'none'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-subtle)'; }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                        <path d="M10,11v6"/><path d="M14,11v6"/>
                        <path d="M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Gambar jika ada */}
                {soal.gambar_url && (
                  <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border)', maxWidth: 280 }}>
                    <img src={soal.gambar_url} alt={`Gambar soal ${idx + 1}`} style={{ width: '100%', display: 'block', maxHeight: 160, objectFit: 'contain', background: 'var(--color-surface-raised)' }} />
                  </div>
                )}

                {/* Opsi grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {OPSI_LIST.map(({ key, label }) => {
                    const isBenar = soal.jawaban_benar === label;
                    const teks = soal[key];
                    return (
                      <div
                        key={key}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '6px 10px',
                          background: isBenar ? 'var(--color-success-bg)' : 'var(--color-surface-raised)',
                          border: isBenar ? '1.5px solid var(--color-success)' : '1px solid var(--color-border-subtle)',
                          borderRadius: 6,
                        }}
                      >
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                          color: isBenar ? 'var(--color-success)' : 'var(--color-text-subtle)',
                          minWidth: 14,
                        }}>
                          {label}
                        </span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-text)', lineHeight: 1.4 }}>
                          {teks}
                        </span>
                        {isBenar && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-success)', marginLeft: 'auto', flexShrink: 0 }}>
                            <polyline points="20,6 9,17 4,12"/>
                          </svg>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
          ))}
          </div>
        )}

        {/* Confirm modal hapus soal */}
        {confirmDeleteId && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <div style={{ background: 'var(--color-surface)', border: '2px solid var(--color-border)', borderRadius: '0.75rem', padding: '1.5rem', width: 360, maxWidth: '90vw' }}>
              <h2 style={{ margin: '0 0 0.75rem', fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>Hapus Soal</h2>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.9375rem', color: 'var(--color-text)', lineHeight: 1.5 }}>
                Hapus soal ini? Tindakan tidak bisa dibatalkan.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setConfirmDeleteId('')}>Batal</button>
                <button
                  className="btn btn-sm"
                  style={{ background: 'var(--color-danger)', color: '#fff', border: 'none', fontWeight: 600, padding: '0.5rem 1rem', borderRadius: '0.5rem', cursor: 'pointer' }}
                  onClick={() => doDelete(confirmDeleteId)}
                >
                  Ya, Hapus
                </button>
              </div>
            </div>
          </div>
        )}

        <Toast toast={toast} onClose={() => setToast(null)} />
      </main>
    </div>
  );
}
