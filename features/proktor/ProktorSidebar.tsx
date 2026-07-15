'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';

const NAV_ITEMS = [
  {
    href: '/proktor/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
        <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    ),
  },
  {
    href: '/proktor/monitoring',
    label: 'Monitoring Real-Time',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
      </svg>
    ),
  },
  {
    href: '/proktor/jadwal',
    label: 'Kelola Jadwal',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
  {
    href: '/proktor/akun',
    label: 'Kelola Akun',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  const { user } = useAuth();

  const W = collapsed ? 56 : 240;
  const initial = user?.nama?.charAt(0)?.toUpperCase() ?? 'P';

  return (
    <aside
      aria-label="Navigasi utama"
      style={{
        width: W, minWidth: W, maxWidth: W,
        height: 'calc(100dvh - 56px)',
        position: 'sticky',
        top: 56,
        background: 'var(--color-surface)',
        borderRight: '1px solid var(--color-border)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease',
        overflow: 'hidden',
        zIndex: 40,
      }}
    >
      {/* ── Toggle button row ── */}
      <div style={{
        height: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-end',
        padding: collapsed ? 0 : '0 10px',
        flexShrink: 0,
      }}>
        <button
          onClick={onToggle}
          title={collapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
          aria-label={collapsed ? 'Buka sidebar' : 'Ciutkan sidebar'}
          style={{
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none',
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            color: 'var(--color-text-subtle)',
            cursor: 'pointer',
            transition: 'background 0.12s, color 0.12s',
            flexShrink: 0,
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-surface-raised)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'none';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-subtle)';
          }}
        >
          {collapsed ? (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9,18 15,12 9,6"/>
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Section label ── */}
      {!collapsed && (
        <div style={{
          padding: '8px 16px 4px',
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--color-text-subtle)',
          flexShrink: 0,
        }}>
          Menu
        </div>
      )}

      {/* ── Navigation ── */}
      <nav
        role="navigation"
        aria-label="Menu proktor"
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '4px 8px' }}
      >
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? 'page' : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: collapsed ? '10px 0' : '9px 12px',
                justifyContent: collapsed ? 'center' : 'flex-start',
                borderRadius: 8,
                textDecoration: 'none',
                marginBottom: 2,
                background: active ? 'var(--color-primary-subtle)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
                fontWeight: active ? 600 : 400,
                fontSize: '0.8125rem',
                transition: 'background 0.12s, color 0.12s, transform 0.1s',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                borderLeft: active && !collapsed ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
              onMouseEnter={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'var(--color-surface-raised)';
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text)';
                  (e.currentTarget as HTMLAnchorElement).style.transform = 'translateX(2px)';
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                  (e.currentTarget as HTMLAnchorElement).style.color = 'var(--color-text-muted)';
                  (e.currentTarget as HTMLAnchorElement).style.transform = 'translateX(0)';
                }
              }}
            >
              <span style={{
                flexShrink: 0, display: 'flex', alignItems: 'center',
                color: active ? 'var(--color-primary)' : 'var(--color-text-subtle)',
              }}>
                {item.icon}
              </span>
              {!collapsed && (
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── User profile card at bottom ── */}
      <div style={{
        borderTop: '1px solid var(--color-border)',
        padding: collapsed ? '12px 8px' : '12px',
        flexShrink: 0,
      }}>
        {collapsed ? (
          /* Collapsed: just avatar */
          <div style={{
            width: 32, height: 32,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.75rem', fontWeight: 700,
            margin: '0 auto',
          }}>
            {initial}
          </div>
        ) : (
          /* Expanded: full profile card */
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '10px 12px',
            background: 'var(--color-surface-raised)',
            borderRadius: 10,
            border: '1px solid var(--color-border-subtle)',
            transition: 'background 0.15s',
            cursor: 'default',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--color-primary-subtle)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLDivElement).style.background = 'var(--color-surface-raised)';
          }}
          >
            {/* Avatar */}
            <div style={{
              width: 34, height: 34,
              borderRadius: '50%',
              background: 'var(--color-primary)',
              color: 'var(--color-text-inverse)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.8125rem', fontWeight: 700,
              flexShrink: 0,
            }}>
              {initial}
            </div>
            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.8125rem', fontWeight: 600,
                color: 'var(--color-text)',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                lineHeight: 1.3,
              }}>
                {user?.nama ?? 'Proktor'}
              </div>
              <div style={{
                fontSize: '0.6875rem',
                color: 'var(--color-text-subtle)',
                textTransform: 'capitalize',
                lineHeight: 1.3,
              }}>
                {user?.role ?? 'proktor'}
              </div>
            </div>
            {/* Online dot */}
            <div style={{
              width: 8, height: 8,
              borderRadius: '50%',
              background: 'var(--color-success)',
              flexShrink: 0,
            }} title="Online" />
          </div>
        )}
      </div>
    </aside>
  );
}
