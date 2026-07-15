'use client';

import { useEffect, useRef, useCallback } from 'react';

interface UseAntiCheatOptions {
  /** Aktifkan fullscreen mode — hanya untuk ExamPage */
  enableFullscreen?: boolean;
  /** Apakah anti-cheat aktif (false saat submitted/selesai) */
  active: boolean;
}

/**
 * Hook anti-cheat untuk siswa.
 * - Block semua shortcut yang bisa meninggalkan halaman
 * - Fullscreen mode (opsional, untuk ExamPage)
 * - Saat fullscreen exit, paksa masuk kembali
 */
export function useAntiCheat({ enableFullscreen = false, active }: UseAntiCheatOptions) {
  const isActiveRef = useRef(active);

  // Sync ref agar event handler selalu dapat nilai terbaru tanpa re-register
  useEffect(() => {
    isActiveRef.current = active;
  }, [active]);

  // ── Fullscreen management ─────────────────────────────────────
  const enterFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {
        // Beberapa browser memblokir saat tidak ada user gesture — abaikan
      });
    }
  }, []);

  // Masuk fullscreen saat aktif pertama kali
  useEffect(() => {
    if (!enableFullscreen || !active) return;
    enterFullscreen();
  }, [enableFullscreen, active, enterFullscreen]);

  // Paksa kembali ke fullscreen jika siswa keluar
  useEffect(() => {
    if (!enableFullscreen || !active) return;

    function handleFullscreenChange() {
      if (!isActiveRef.current) return;
      if (!document.fullscreenElement) {
        // Delay singkat agar browser tidak throttle request
        setTimeout(() => enterFullscreen(), 300);
      }
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [enableFullscreen, active, enterFullscreen]);

  // Keluar fullscreen saat tidak aktif lagi (ujian selesai)
  useEffect(() => {
    if (!enableFullscreen) return;
    if (!active && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  }, [enableFullscreen, active]);

  // ── Block shortcuts ───────────────────────────────────────────
  useEffect(() => {
    if (!active) return;

    function blockKey(e: KeyboardEvent) {
      const key = e.key;
      const ctrl = e.ctrlKey || e.metaKey;
      const alt  = e.altKey;

      // Alt+Tab, Alt+F4, Alt+Left/Right (browser back/forward)
      if (alt && (key === 'Tab' || key === 'F4' || key === 'ArrowLeft' || key === 'ArrowRight')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Ctrl+W (tutup tab), Ctrl+T (tab baru), Ctrl+N (window baru),
      // Ctrl+R/F5 (reload), Ctrl+L (focus address bar),
      // Ctrl+Tab / Ctrl+Shift+Tab (pindah tab)
      if (ctrl && (
        key === 'w' || key === 'W' ||
        key === 't' || key === 'T' ||
        key === 'n' || key === 'N' ||
        key === 'r' || key === 'R' ||
        key === 'l' || key === 'L' ||
        key === 'Tab'
      )) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // F5 (reload), F11 (toggle fullscreen manual), Escape (exit fullscreen / dialog)
      if (key === 'F5' || key === 'F11' || key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Windows key / Meta key
      if (key === 'Meta' || key === 'OS') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // capture: true agar intercept sebelum browser handle
    window.addEventListener('keydown', blockKey, { capture: true });
    return () => window.removeEventListener('keydown', blockKey, { capture: true });
  }, [active, enableFullscreen]);

  // ── Block context menu (klik kanan) ───────────────────────────
  useEffect(() => {
    if (!active) return;

    function blockContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    document.addEventListener('contextmenu', blockContextMenu);
    return () => document.removeEventListener('contextmenu', blockContextMenu);
  }, [active]);

  return { enterFullscreen };
}
