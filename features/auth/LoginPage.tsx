'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';

// YouTube video ID dari link: https://youtu.be/k__MFCy3P1s
const YT_VIDEO_ID = 'k__MFCy3P1s';

const WELCOME_TEXTS = [
  'Selamat Datang di E-CBT MTS WAHA',
  'Ujian Digital — Mudah, Cepat, Akurat',
  'Evaluasi Berbasis Komputer MTS WAHA',
  'Semangat Belajar, Raih Prestasi Terbaik',
];

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [textIdx, setTextIdx]   = useState(0);
  const [fade, setFade]         = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setTextIdx(i => (i + 1) % WELCOME_TEXTS.length);
        setFade(true);
      }, 500);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 300));
    const result = login(username.trim(), password);
    setLoading(false);
    if (!result.ok) { setError(result.error ?? 'Login gagal.'); return; }
    const saved = sessionStorage.getItem('umbk_user');
    if (!saved) return;
    const user = JSON.parse(saved);
    if (user.role === 'siswa')        router.replace('/siswa/dashboard');
    else if (user.role === 'guru')    router.replace('/guru/dashboard');
    else if (user.role === 'proktor') router.replace('/proktor/dashboard');
    else router.replace('/');
  }

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', position: 'relative', overflow: 'hidden', backgroundColor: '#0a0a0a' }}>

      {/* ── Video Background YouTube — video only, no controls, no subtitle, muted ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        pointerEvents: 'none', overflow: 'hidden',
      }}>
        <iframe
          src={`https://www.youtube.com/embed/${YT_VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${YT_VIDEO_ID}&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0&vq=hd1080&cc_load_policy=0&cc=0&hl=id`}
          allow="autoplay"
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '177.78vh',
            minWidth: '100%',
            height: '56.25vw',
            minHeight: '100%',
            border: 'none',
            pointerEvents: 'none',
          }}
          title="background"
        />
        {/* Overlay gelap agar form tetap terbaca */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.55) 50%, rgba(0,0,0,0.72) 100%)',
        }} />
      </div>

      {/* ── Layout: kiri teks | kanan form ────────────────────── */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', width: '100%',
        alignItems: 'center', justifyContent: 'center',
        padding: '2rem 1rem',
        gap: '3rem',
        flexWrap: 'wrap',
      }}>

        {/* ── Sisi kiri: Branding + animasi teks ─────────────── */}
        <div style={{ flex: '1 1 320px', maxWidth: 480, color: '#fff', textAlign: 'center' }}>
          {/* Logo */}
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(8px)',
            border: '2px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.5rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              <path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>

          {/* Nama sekolah */}
          <h1 style={{
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            fontWeight: 900,
            margin: '0 0 0.5rem',
            letterSpacing: '-0.02em',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
          }}>
            E-CBT
          </h1>
          <p style={{
            fontSize: 'clamp(0.875rem, 2vw, 1.125rem)',
            fontWeight: 600,
            margin: '0 0 2rem',
            color: 'rgba(255,255,255,0.8)',
            letterSpacing: '0.05em',
          }}>
            MTS WAHA
          </p>

          {/* Animasi teks */}
          <div style={{
            minHeight: '3rem',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <p style={{
              fontSize: 'clamp(0.875rem, 2vw, 1.125rem)',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.92)',
              textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              margin: 0,
              transition: 'opacity 0.5s ease',
              opacity: fade ? 1 : 0,
              maxWidth: 380,
              lineHeight: 1.5,
            }}>
              {WELCOME_TEXTS[textIdx]}
            </p>
          </div>
        </div>

        {/* ── Sisi kanan: Form login ──────────────────────────── */}
        <div style={{
          flex: '0 0 auto', width: '100%', maxWidth: 400,
          background: 'rgba(255,255,255,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.18)',
          borderRadius: '1rem',
          padding: '2rem',
          boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
        }}>
          <h2 style={{
            margin: '0 0 0.25rem',
            fontSize: '1.375rem',
            fontWeight: 800,
            color: '#fff',
          }}>
            Masuk ke Akun
          </h2>
          <p style={{ margin: '0 0 1.75rem', fontSize: '0.875rem', color: 'rgba(255,255,255,0.6)' }}>
            Gunakan username dan password yang diberikan
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }}
                placeholder="Masukkan username"
                autoComplete="username"
                required
                style={{
                  width: '100%', padding: '0.625rem 0.875rem',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '0.5rem',
                  color: '#fff', fontSize: '0.9375rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'rgba(255,255,255,0.8)', marginBottom: '0.375rem' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
                style={{
                  width: '100%', padding: '0.625rem 0.875rem',
                  background: 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '0.5rem',
                  color: '#fff', fontSize: '0.9375rem',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            {error && (
              <div style={{
                padding: '0.625rem 0.875rem',
                background: 'rgba(239,68,68,0.2)',
                border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: '0.5rem',
                fontSize: '0.875rem', color: '#fca5a5',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem',
                background: loading ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.9)',
                border: 'none', borderRadius: '0.5rem',
                color: '#fff', fontSize: '1rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: '0.25rem',
                transition: 'background 0.2s',
              }}
            >
              {loading ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{
            marginTop: '1.5rem',
            padding: '0.875rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '0.5rem',
          }}>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Demo Akun
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {[
                { role: 'Proktor', u: 'proktor', p: 'proktor123' },
                { role: 'Guru',    u: 'guru1',   p: 'guru123' },
                { role: 'Siswa',   u: '001',      p: 'siswa123' },
              ].map(a => (
                <div key={a.u} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ padding: '0.125rem 0.5rem', background: 'rgba(255,255,255,0.12)', borderRadius: '0.25rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', minWidth: 52, textAlign: 'center' }}>
                    {a.role}
                  </span>
                  <code style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8125rem' }}>{a.u}</code>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>/</span>
                  <code style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.8125rem' }}>{a.p}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
