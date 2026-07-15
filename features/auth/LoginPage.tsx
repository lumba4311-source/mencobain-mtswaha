'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

const PORSENI_VIDEO_URL = '/assets/porseni.mp4';
const TAHUN_AJARAN = '2025 / 2026';
const VERSI_SISTEM = 'v2.1.0';

// ── Icon components (Lucide-style outline) ──────────────────────────
function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconEye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function IconLoader() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="login-spinner">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconAward() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────
export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400));
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.ok) { setError(result.error ?? 'Login gagal.'); return; }
    // Ambil role dari result langsung — tidak bergantung sessionStorage
    const role = result.role;
    if (role === 'siswa') router.replace('/siswa/dashboard');
    else if (role === 'guru') router.replace('/guru/dashboard');
    else if (role === 'proktor') router.replace('/proktor/dashboard');
    else router.replace('/');
  }

  return (
    <div className="login-root">

      {/* ── Abstract blur shapes background ── */}
      <div className="login-bg-shape login-bg-shape-1" aria-hidden="true" />
      <div className="login-bg-shape login-bg-shape-2" aria-hidden="true" />
      <div className="login-bg-shape login-bg-shape-3" aria-hidden="true" />

      {/* ── Main layout ── */}
      <div className="login-layout">

        {/* ══════════════════════════════════════
            KOLOM KIRI — Video + Overlay Info
        ══════════════════════════════════════ */}
        <div className="login-video-col">
          <div className="login-video-wrapper">

            {/* Video porseni dari Supabase Storage */}
            <video
              src={PORSENI_VIDEO_URL}
              autoPlay
              muted
              loop
              playsInline
              className="login-video-iframe"
              tabIndex={-1}
            />

            {/* Overlay gelap */}
            <div className="login-video-overlay" aria-hidden="true" />

            {/* Blocker — prevents YouTube hover UI (pause/next/prev) */}
            <div className="login-video-blocker" aria-hidden="true" />

            {/* Overlay info */}
            <div className="login-video-info">
              {/* Logo */}
              <div className="login-video-logo">
                <img src="/favicon.ico" alt="Logo MTS WAHA" width={52} height={52} style={{ objectFit: 'contain' }} />
              </div>

              {/* Nama sistem */}
              <div className="login-video-system">CBT Examination System</div>

              {/* Nama sekolah */}
              <h1 className="login-video-school">MTS WAHA</h1>

              {/* Tagline */}
              <p className="login-video-tagline">
                "Belajar dengan Jujur,<br />Raih Prestasi Terbaik"
              </p>

              {/* Feature pills */}
              <div className="login-video-pills">
                <div className="login-pill">
                  <IconShield />
                  <span>Aman & Terpercaya</span>
                </div>
                <div className="login-pill">
                  <IconAward />
                  <span>Penilaian Akurat</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════
            KOLOM KANAN — Login Card
        ══════════════════════════════════════ */}
        <div className="login-card-col">
          <div className="login-card">

            {/* Logo + header */}
            <div className="login-card-header">
              {/* ThemeToggle — top right corner of card */}
              <div style={{ position: 'absolute', top: 16, right: 16 }}>
                <ThemeToggle />
              </div>
              <div className="login-card-logo">
                <img src="/favicon.ico" alt="Logo MTS WAHA" width={150} height={150} style={{ objectFit: 'contain' }} />
              </div>
              <h2 className="login-card-title">Selamat Datang</h2>
              <p className="login-card-subtitle">
                Silakan masuk menggunakan akun yang telah diberikan.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="login-form" noValidate>

              {/* Error */}
              {error && (
                <div className="login-error" role="alert">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Username */}
              <div className="login-field">
                <label className="login-label" htmlFor="login-username">Username</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><IconUser /></span>
                  <input
                    id="login-username"
                    type="text"
                    className="login-input"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setError(''); }}
                    placeholder="Masukkan username"
                    autoComplete="username"
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Password */}
              <div className="login-field">
                <label className="login-label" htmlFor="login-password">Password</label>
                <div className="login-input-wrap">
                  <span className="login-input-icon"><IconLock /></span>
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    className="login-input login-input-password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    placeholder="Masukkan password"
                    autoComplete="current-password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="login-eye-btn"
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? 'Sembunyikan password' : 'Tampilkan password'}
                    tabIndex={-1}
                  >
                    {showPass ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="login-btn"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <IconLoader />
                    <span>Memverifikasi...</span>
                  </>
                ) : (
                  <span>Masuk</span>
                )}
              </button>

            </form>

            {/* Footer info */}
            <div className="login-card-footer">
              <div className="login-footer-divider" />

              <div className="login-footer-info">
                <span>Tahun Ajaran {TAHUN_AJARAN}</span>
                <span className="login-footer-dot" aria-hidden="true">·</span>
                <span>Sistem CBT {VERSI_SISTEM}</span>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
