'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import CustomSelect from '@/components/CustomSelect';
import type { Kelas, JenisUjian, Ujian } from '@/types';

type CreateUjianInput = {
  nama_ujian: string; jenis_ujian: JenisUjian; durasi: number;
  acak_soal: boolean; acak_opsi: boolean;
  tampil_hasil: boolean; kelas_ids: string[];
};

const JENIS_UJIAN: JenisUjian[] = ['UMBK', 'UAS', 'PAS', 'PTS', 'TRYOUT', 'LATIHAN'];

export default function EditUjianPage() {
  const { user, guru, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const ujianId = searchParams.get('ujian') ?? '';

  const [ujian, setUjian] = useState<Ujian | null>(null);
  const [form, setForm] = useState<Omit<CreateUjianInput, 'id_guru'> | null>(null);
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'guru' || !guru) { router.replace('/login'); return; }
    Promise.all([
      fetch(`/api/ujian/${ujianId}`).then(r => r.json()),
      fetch('/api/akun').then(r => r.json()),
    ]).then(([found, akun]) => {
      if (!found || found.id_guru !== guru.id) { router.replace('/guru/dashboard'); return; }
      setUjian(found);
      setForm({
        nama_ujian: found.nama_ujian,
        jenis_ujian: found.jenis_ujian,
        durasi: found.durasi,
        acak_soal: found.acak_soal,
        acak_opsi: found.acak_opsi,
        tampil_hasil: found.tampil_hasil,
        kelas_ids: [...(found.kelas_ids ?? [])],
      });
      setKelasList(akun.kelas ?? []);
    }).catch(() => router.replace('/guru/dashboard'));
  }, [isLoading, user, guru, ujianId, router]);

  function handleToggleKelas(kelasId: string) {
    if (!form) return;
    setForm(p => p ? {
      ...p,
      kelas_ids: (p.kelas_ids ?? []).includes(kelasId)
        ? (p.kelas_ids ?? []).filter(id => id !== kelasId)
        : [...(p.kelas_ids ?? []), kelasId],
    } : p);
  }

  async function handleSubmit() {
    if (!form || !ujian) return;
    setError('');
    if (!form.nama_ujian.trim()) { setError('Nama ujian wajib diisi.'); return; }
    if (form.durasi !== undefined && form.durasi < 1) { setError('Durasi minimal 1 menit.'); return; }
    if ((form.kelas_ids ?? []).length === 0) { setError('Pilih minimal 1 kelas.'); return; }

    setSaving(true);
    try {
      const res = await fetch(`/api/ujian/${ujian.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Gagal menyimpan (HTTP ${res.status}).`);
        setSaving(false);
        return;
      }
      router.replace('/guru/dashboard');
    } catch {
      setError('Gagal menyimpan. Periksa koneksi internet.');
      setSaving(false);
    }
  }

  if (isLoading || !user || !guru || !ujian || !form) return null;

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1 }}>
          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>E-CBT MTS WAHA</span>
          <span style={{ color: 'var(--color-border)', fontSize: '1rem' }}>|</span>
          <Link href="/guru/dashboard" style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textDecoration: 'none' }}>Dashboard</Link>
          <span style={{ color: 'var(--color-border)' }}>/</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Edit Ujian</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ThemeToggle />
        </div>
      </header>

      <main className="page-container" style={{ paddingTop: '1.5rem' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Link href="/guru/dashboard" className="btn btn-ghost btn-sm">← Kembali</Link>
            <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)' }}>Edit Ujian</h1>
          </div>

          {error && (
            <div style={{ padding: '0.75rem 1rem', background: 'var(--color-danger-subtle)', border: '1px solid var(--color-danger)', borderRadius: 'var(--radius-md)', color: 'var(--color-danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text)' }}>Informasi Ujian</h2>
            <div style={{ display: 'grid', gap: '1rem' }}>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-text)' }}>Nama Ujian *</label>
                <input className="input" type="text" placeholder="Contoh: UAS Bahasa Indonesia Semester 1"
                  value={form.nama_ujian}
                  onChange={e => setForm(p => p ? { ...p, nama_ujian: e.target.value } : p)} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-text)' }}>Jenis Ujian *</label>
                <CustomSelect
                  value={form.jenis_ujian ?? ''}
                  onChange={v => setForm(p => p ? { ...p, jenis_ujian: v as JenisUjian } : p)}
                  options={JENIS_UJIAN.map(j => ({ value: j, label: j }))}
                />
              </div>

              <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.375rem', color: 'var(--color-text)' }}>Durasi (menit) *</label>
                  <input className="input" type="number" min={1} max={300}
                    value={form.durasi}
                    onChange={e => setForm(p => p ? { ...p, durasi: parseInt(e.target.value) || 0 } : p)} />
                </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text)' }}>Konfigurasi</h2>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {[
                { key: 'acak_soal',    label: 'Acak urutan soal',             desc: 'Setiap siswa mendapat urutan soal yang berbeda' },
                { key: 'acak_opsi',    label: 'Acak urutan pilihan jawaban',  desc: 'Opsi A–E diacak per siswa per soal' },
                { key: 'tampil_hasil', label: 'Tampilkan hasil ke siswa',     desc: 'Siswa bisa lihat nilai setelah submit' },
              ].map(cfg => (
                <label key={cfg.key} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '0.625rem', borderRadius: 'var(--radius-md)', background: 'var(--color-surface-alt)' }}>
                  <input
                    type="checkbox"
                    checked={(form as Record<string, unknown>)[cfg.key] as boolean}
                    onChange={e => setForm(p => p ? { ...p, [cfg.key]: e.target.checked } : p)}
                    style={{ accentColor: 'var(--color-primary)', width: 16, height: 16, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text)' }}>{cfg.label}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{cfg.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--color-text)' }}>
              Kelas Target ({(form.kelas_ids ?? []).length} dipilih)
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {kelasList.map(k => {
                const active = (form.kelas_ids ?? []).includes(k.id);
                return (
                  <button
                    key={k.id}
                    onClick={() => handleToggleKelas(k.id)}
                    className={active ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
                  >
                    {active ? '✓ ' : ''}Kelas {k.nama_kelas}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Link href="/guru/dashboard" className="btn btn-ghost">Batal</Link>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
