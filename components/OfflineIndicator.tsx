'use client';

import { useAuth } from '@/features/auth/AuthProvider';

export default function OfflineIndicator() {
  const { isOffline } = useAuth();
  if (!isOffline) return null;

  return (
    <div style={{
      position:       'fixed',
      bottom:         '1rem',
      left:           '50%',
      transform:      'translateX(-50%)',
      zIndex:         9999,
      background:     '#1e293b',
      color:          '#fbbf24',
      padding:        '0.5rem 1.25rem',
      borderRadius:   '2rem',
      fontSize:       '0.8125rem',
      fontWeight:     600,
      display:        'flex',
      alignItems:     'center',
      gap:            '0.5rem',
      boxShadow:      '0 4px 16px rgba(0,0,0,0.35)',
      border:         '1px solid rgba(251,191,36,0.3)',
      pointerEvents:  'none',
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', display: 'inline-block' }} />
      Koneksi terputus — data tersimpan, menyambung kembali...
    </div>
  );
}
