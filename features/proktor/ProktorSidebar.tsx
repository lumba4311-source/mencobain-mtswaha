'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV_ITEMS = [
  {
    href: '/proktor/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/proktor/monitoring',
    label: 'Monitoring Real-Time',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    href: '/proktor/jadwal',
    label: 'Kelola Jadwal',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/proktor/akun',
    label: 'Kelola Akun',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
  {
    href: '/proktor/hasil',
    label: 'Hasil Ujian',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14,2 14,8 20,8"/>
        <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
        <polyline points="10,9 9,9 8,9"/>
      </svg>
    ),
  },
];

interface ProktorSidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export default function ProktorSidebar({ collapsed = false, onToggle }: ProktorSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();

  function handleLogout() {
    logout();
    router.replace('/login');
  }

  const W = collapsed ? 64 : 240;

  return (
    <aside style={{
      width: W, minWidth: W, maxWidth: W,
      height: '100dvh', position: 'sticky', top: 0,
      background: 'var(--color-surface)',
      borderRight: '2px solid var(--color-border)',
      display: 'flex', flexDirection: 'column',
      transition: 'width 0.2s, min-width 0.2s, max-width 0.2s',
      overflow: 'hidden',
      zIndex: 50,
    }}>

      {/* Header: logo + toggle button — ALWAYS VISIBLE */}
      <div style={{
        height: 56, minHeight: 56,
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '0' : '0 0.75rem 0 1rem',
        borderBottom: '2px solid var(--color-border)',
        gap: '0.5rem',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', overflow: 'hidden' }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'var(--color-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
                <path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: '0.875rem', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              E-CBT MTS WAHA
            </span>
          </div>
        )}

        {/* Toggle button — ALWAYS VISIBLE regardless of collapsed state */}
        <button
          onClick={onToggle}
          title={collapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
          style={{
            width: 32, height: 32, flexShrink: 0,
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: '0.375rem',
            color: 'var(--color-text-muted)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          {collapsed ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.5rem 0' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: collapsed ? '0.625rem 0' : '0.625rem 1rem',
                justifyContent: collapsed ? 'center' : 'flex-start',
                margin: '0.125rem 0.5rem',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                background: active ? 'var(--color-primary-subtle)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: active ? 700 : 500,
                fontSize: '0.875rem',
                transition: 'background 0.15s, color 0.15s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
              }}
            >
              <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{item.icon}</span>
              {!collapsed && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user info + ThemeToggle + logout */}
      <div style={{
        borderTop: '2px solid var(--color-border)',
        padding: collapsed ? '0.75rem 0.5rem' : '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        {/* ThemeToggle — selalu visible */}
        <div style={{ display: 'flex', justifyContent: collapsed ? 'center' : 'flex-start' }}>
          <ThemeToggle />
        </div>

        {/* User info (hanya saat expanded) */}
        {!collapsed && user && (
          <div style={{
            padding: '0.5rem 0.625rem',
            background: 'var(--color-surface-alt)',
            borderRadius: '0.375rem',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.nama}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>
              {user.role}
            </div>
          </div>
        )}

        {/* Logout button */}
        {!collapsed ? (
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: '0.5rem 0.75rem',
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              fontSize: '0.8125rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Keluar
          </button>
        ) : (
          <button
            onClick={handleLogout}
            title="Keluar"
            style={{
              padding: '0.5rem',
              background: 'none',
              border: '1px solid var(--color-border)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-muted)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        )}
      </div>
    </aside>
  );
}
