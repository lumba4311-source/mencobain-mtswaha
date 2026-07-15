'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

interface AppTopbarProps {
  /** Page label shown after the divider, e.g. "Dashboard", "Kelola Jadwal" */
  pageLabel?: string;
}

export default function AppTopbar({ pageLabel }: AppTopbarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  const initial = user?.nama?.charAt(0)?.toUpperCase() ?? '?';

  return (
    <header className="topbar">
      {/* ── LEFT: Logo + App name + page label ── */}
      <div className="topbar-left">
        <img src="/favicon.ico" alt="Logo MTS WAHA" width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} />
        <span className="topbar-appname">E-CBT MTS WAHA</span>
        {pageLabel && (
          <>
            <div className="topbar-divider" aria-hidden="true" />
            <span className="topbar-page-label">{pageLabel}</span>
          </>
        )}
      </div>

      {/* ── CENTER: Theme toggle ── */}
      <div className="topbar-center">
        <ThemeToggle />
      </div>

      {/* ── RIGHT: User chip + logout ── */}
      <div className="topbar-right">
        {user && (
          <div className="topbar-user" aria-label={`Masuk sebagai ${user.nama}`}>
            <div className="topbar-avatar" aria-hidden="true">{initial}</div>
            <span className="topbar-username">{user.nama}</span>
          </div>
        )}
        <button
          onClick={handleLogout}
          aria-label="Keluar dari aplikasi"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '5px 12px',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--color-text-muted)',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'background 0.15s, color 0.15s, border-color 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-danger-bg)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-danger)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-danger)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)';
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16,17 21,12 16,7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Keluar
        </button>
      </div>
    </header>
  );
}
