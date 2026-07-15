// ============================================================
// UMBK — MTS WAHA — Auth Debug Logger
// Aktifkan via: AUTH_DEBUG=true di .env.local
// ============================================================

const DEBUG = process.env.NEXT_PUBLIC_AUTH_DEBUG === 'true';

type AuthEvent =
  | 'LOGIN_SUCCESS'
  | 'SESSION_FOUND'
  | 'SESSION_NOT_FOUND'
  | 'ACCESS_TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_SUCCESS'
  | 'REFRESH_TOKEN_FAILED'
  | 'SESSION_RESTORED'
  | 'REDIRECT_LOGIN'
  | 'REDIRECT_DASHBOARD'
  | 'NETWORK_ERROR'
  | 'TOKEN_VALIDATION'
  | 'AUTO_REFRESH_SESSION';

export function authLog(event: AuthEvent, detail?: string | Record<string, unknown>) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().slice(11, 23);
  const msg = typeof detail === 'string' ? detail : JSON.stringify(detail ?? '');
  console.log(`[AUTH ${ts}] ${event}${msg ? ` — ${msg}` : ''}`);
}

export function authWarn(event: AuthEvent, detail?: string | Record<string, unknown>) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().slice(11, 23);
  const msg = typeof detail === 'string' ? detail : JSON.stringify(detail ?? '');
  console.warn(`[AUTH ${ts}] ${event}${msg ? ` — ${msg}` : ''}`);
}

export function authError(event: AuthEvent, detail?: string | Record<string, unknown>) {
  if (!DEBUG) return;
  const ts = new Date().toISOString().slice(11, 23);
  const msg = typeof detail === 'string' ? detail : JSON.stringify(detail ?? '');
  console.error(`[AUTH ${ts}] ${event}${msg ? ` — ${msg}` : ''}`);
}
