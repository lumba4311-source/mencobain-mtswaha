'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';

import AppTopbar from '@/components/AppTopbar';

export default function BuatUjianPage() {
  const { user, guru, isLoading } = useAuth();
  const router = useRouter();
  const [namaUjian, setNamaUjian] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'guru' || !guru) { router.replace('/login'); return; }
  }, [isLoading, user, guru, router]);

  if (isLoading || !user || !guru) return null;

  async function handleSubmit() {
    setError('');
    if (!namaUjian.trim()) { setError('Nama ujian wajib diisi.'); return; }
    if (!guru) return;
    setSaving(true);
    try {
      const res = await fetch('/api/ujian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama_ujian: namaUjian.trim(),
          id_guru: guru.id,
          jenis_ujian: 'LATIHAN',
          durasi: 90,
          acak_soal: true,
          acak_opsi: true,
          tampil_hasil: false,
          kelas_ids: [],
        }),
      });
      const ujian = await res.json();
      if (!res.ok) { setError(ujian.error ?? 'Gagal membuat ujian.'); return; }
      router.push(`/guru/soal?ujian=${ujian.id}`);
    } catch {
      setError('Terjadi kesalahan. Periksa koneksi dan coba lagi.');
    } finally {
      // D-01: finally memastikan tombol tidak stuck meski terjadi network error
      setSaving(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--color-bg)' }}>
      <AppTopbar pageLabel="Buat Ujian" />

      <main style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{
          width: '100%', maxWidth: 480,
          background: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: 14,
          boxShadow: 'var(--shadow-md)',
          overflow: 'hidden',
        }}>
          {/* Card header */}
          <div style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--color-border)',
            background: 'var(--color-surface-raised)',
          }}>
            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Link href="/guru/dashboard" style={{ fontSize: '0.6875rem', color: 'var(--color-text-subtle)', fontWeight: 500, textDecoration: 'none' }}>
                Dashboard
              </Link>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-subtle)' }}>
                <polyline points="9,18 15,12 9,6"/>
              </svg>
              <span style={{ fontSize: '0.6875rem', color: 'var(--color-secondary)', fontWeight: 600 }}>
                Buat Ujian
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)' }}>
              Buat Ujian Baru
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
              Masukkan nama ujian. Soal dapat ditambahkan setelah ujian dibuat.
            </p>
          </div>

          {/* Card body */}
          <div style={{ padding: '24px' }}>
            {/* Nama Ujian */}
            <div style={{ marginBottom: 20 }}>
              <label htmlFor="nama_ujian" style={{
                display: 'block', marginBottom: 6,
                fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)',
              }}>
                Nama Ujian <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="nama_ujian"
                className="form-input"
                type="text"
                placeholder="Contoh: Ujian Tengah Semester Matematika"
                value={namaUjian}
                onChange={e => { setNamaUjian(e.target.value); setError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
                autoFocus
                style={{ width: '100%' }}
              />
            </div>

            {/* Info box — sistem otomatis */}
            <div style={{
              display: 'flex', gap: 10,
              padding: '12px 14px',
              background: 'color-mix(in srgb, var(--color-secondary) 8%, transparent)',
              border: '1px solid color-mix(in srgb, var(--color-secondary) 20%, transparent)',
              borderRadius: 8,
              marginBottom: 20,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--color-secondary)', flexShrink: 0, marginTop: 1 }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--color-text)', display: 'block', marginBottom: 2 }}>Konfigurasi otomatis sistem:</strong>
                Acak urutan soal & jawaban aktif. Semua siswa otomatis terdaftar. Penilaian dihitung otomatis (100 ÷ jumlah soal per soal).
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                padding: '10px 14px', marginBottom: 16,
                background: 'var(--color-danger-bg)',
                border: '1px solid var(--color-danger-border)',
                borderRadius: 8,
                fontSize: '0.8125rem', color: 'var(--color-danger)', fontWeight: 500,
              }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Link href="/guru/dashboard" className="btn btn-ghost">
                Batal
              </Link>
              <button
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={saving || !namaUjian.trim()}
              >
                {saving ? 'Menyimpan...' : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    Buat & Tambah Soal
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12,5 19,12 12,19"/>
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
