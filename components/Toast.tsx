'use client';

import { useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  msg: string;
  type: ToastType;
}

interface ToastProps {
  toast: ToastData | null;
  onClose: () => void;
  /** Auto-dismiss delay in ms. Default: 4000 */
  duration?: number;
}

const COLORS: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: 'var(--color-success)',  border: '#16a34a', icon: '✓' },
  error:   { bg: 'var(--color-danger)',   border: '#b91c1c', icon: '✕' },
  warning: { bg: 'var(--color-warning)',  border: '#b45309', icon: '⚠' },
  info:    { bg: 'var(--color-primary)',  border: '#1d4ed8', icon: 'ℹ' },
};

export default function Toast({ toast, onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [toast, onClose, duration]);

  if (!toast) return null;

  const c = COLORS[toast.type];

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        background: c.bg,
        border: `2px solid ${c.border}`,
        borderRadius: '0.625rem',
        padding: '0.75rem 1rem',
        maxWidth: 360,
        minWidth: 220,
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        color: '#fff',
        fontSize: '0.9rem',
        fontWeight: 500,
        lineHeight: 1.4,
        animation: 'toast-in 0.2s ease',
      }}
    >
      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: '0.05rem' }}>{c.icon}</span>
      <span style={{ flex: 1 }}>{toast.msg}</span>
      <button
        onClick={onClose}
        aria-label="Tutup notifikasi"
        style={{
          background: 'none', border: 'none', color: '#fff',
          cursor: 'pointer', padding: '0 0.125rem', fontSize: '1rem',
          opacity: 0.8, flexShrink: 0, lineHeight: 1,
        }}
      >
        ×
      </button>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(0.5rem); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
