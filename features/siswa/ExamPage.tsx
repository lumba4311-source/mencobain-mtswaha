'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import type { Soal, SessionUjian, Jawaban, JawabanBenar, JadwalUjian, Ujian } from '@/types';
import { RichText } from '@/components/RichText';

type StatusSoal = 'belum' | 'sudah' | 'ragu';

export default function ExamPage() {
  const { user, siswa, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jadwalId = searchParams.get('jadwal') ?? '';

  const [session, setSession] = useState<SessionUjian | null>(null);
  const [soalList, setSoalList] = useState<Soal[]>([]);
  const [jawaban, setJawaban] = useState<Record<string, Jawaban>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [emptyWarning, setEmptyWarning] = useState('');
  const [phase, setPhase] = useState<'confirm' | 'exam'>('confirm');
  const [startError, setStartError] = useState('');
  const [startLoading, setStartLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [jadwalInfo, setJadwalInfo] = useState<JadwalUjian | null>(null);
  const [ujianInfo, setUjianInfo] = useState<Ujian | null>(null);
  const [notify, setNotify] = useState<{ msg: string; type: 'warning' | 'info' } | null>(null);

  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef      = useRef<SessionUjian | null>(null);
  const timeLeftRef     = useRef(0);
  // [AUTH-01+02] Mutex — cegah handleAutoSubmit dipanggil dua kali bersamaan
  // (bisa terjadi dari timer 1 detik dan re-sync 10 detik secara bersamaan)
  const submittingRef   = useRef(false);

  // Sync refs
  useEffect(() => { sessionRef.current = session; }, [session]);
  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

  // Load jadwal + ujian info for confirm screen
  useEffect(() => {
    if (!jadwalId) return;
    fetch(`/api/jadwal/${jadwalId}`)
      .then(r => r.json())
      .then((j: JadwalUjian & { ujians?: Ujian }) => {
        setJadwalInfo(j);
        // Supabase join mengembalikan field 'ujians' (plural), bukan 'ujian'
        if (j.ujians) setUjianInfo(j.ujians);
        else if (j.id_ujian) {
          fetch(`/api/ujian/${j.id_ujian}`).then(r => r.json()).then(setUjianInfo);
        }
      })
      .catch(console.error);
  }, [jadwalId]);

  // Auto-resume session berlangsung saat mount (refresh saat ujian)
  useEffect(() => {
    if (isLoading || !siswa || !jadwalId) return;
    async function tryResume() {
      if (!siswa) return;
      try {
        const sesRes = await fetch(`/api/session?siswaId=${siswa.id}&jadwalId=${jadwalId}`);
        if (!sesRes.ok) return; // [TIMER-04] Jangan crash jika API error
        const existing: SessionUjian | null = await sesRes.json();
        if (existing && existing.status === 'berlangsung') {
          await resumeExam(existing);
        }
      } catch {
        // Jaringan error saat resume — biarkan siswa mulai dari confirm screen
        console.error('[tryResume] Gagal mengambil session, siswa perlu mulai ulang.');
      }
    }
    tryResume();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, siswa, jadwalId]);

  // Guard — tunggu isLoading selesai dulu baru redirect
  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'siswa' || !siswa) {
      router.replace('/login');
    }
  }, [isLoading, user, siswa, router]);

  // Timer countdown + re-sync dari deadline tiap 30 detik
  useEffect(() => {
    if (phase !== 'exam' || submitted) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Re-sync waktu dari deadline tiap 10 detik untuk cegah clock drift
    // Sekaligus simpan sisa_waktu ke DB sebagai metadata (bukan source of truth)
    saveTimerRef.current = setInterval(() => {
      const ses = sessionRef.current;
      if (!ses) return;

      // Re-sync dari deadline
      const sisaFromDeadline = Math.max(
        0,
        Math.floor((new Date(ses.deadline).getTime() - Date.now()) / 1000)
      );
      setTimeLeft(sisaFromDeadline);
      timeLeftRef.current = sisaFromDeadline;

      if (sisaFromDeadline <= 0) {
        clearInterval(timerRef.current!);
        clearInterval(saveTimerRef.current!);
        handleAutoSubmit();
        return;
      }

      // P6: sisa_waktu dihitung dari deadline di klien — tidak perlu PATCH ke DB tiap 10 detik
      // deadline adalah source of truth, mengurangi 140 req/menit untuk 70 siswa
    }, 10000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, submitted]);

  // Polling cek force_submit tiap 20 detik saat exam berlangsung
  useEffect(() => {
    if (phase !== 'exam' || submitted || !siswa || !jadwalId) return;
    const t = setInterval(async () => {
      if (!siswa) return;
      try {
        const res = await fetch(`/api/session?siswaId=${siswa.id}&jadwalId=${jadwalId}`);
        const ses: SessionUjian | null = await res.json();
        if (ses && (ses.status === 'force_submit' || ses.status === 'selesai') && !submitted) {
          clearInterval(t);
          if (timerRef.current) clearInterval(timerRef.current);
          if (saveTimerRef.current) clearInterval(saveTimerRef.current);
          setTimeLeft(0);
          setSubmitted(true);
          if (ses.status === 'force_submit') {
            setNotify({ msg: 'Jawaban kamu telah disubmit oleh proktor.', type: 'warning' });
          }
          setTimeout(() => router.replace('/siswa/dashboard'), 3000);
        }
      } catch { /* abaikan error jaringan */ }
    }, 20000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, submitted, siswa, jadwalId]);

  // ── Anti-cheat: block keyboard shortcuts saat ujian berlangsung ──────────
  useEffect(() => {
    if (phase !== 'exam' || submitted) return;

    function handleKeyDown(e: KeyboardEvent) {
      // F12 — DevTools
      if (e.key === 'F12') { e.preventDefault(); return; }
      // Ctrl+Shift+I/J/C — DevTools
      if (e.ctrlKey && e.shiftKey && ['i','I','j','J','c','C'].includes(e.key)) { e.preventDefault(); return; }
      // Ctrl+U — View source
      if (e.ctrlKey && (e.key === 'u' || e.key === 'U')) { e.preventDefault(); return; }
      // Ctrl+S — Save page
      if (e.ctrlKey && (e.key === 's' || e.key === 'S')) { e.preventDefault(); return; }
      // Ctrl+P — Print
      if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) { e.preventDefault(); return; }
      // Alt+F4 — Close window
      if (e.altKey && e.key === 'F4') { e.preventDefault(); return; }
      // Alt+Tab — Switch window
      if (e.altKey && e.key === 'Tab') { e.preventDefault(); return; }
      // Windows key (Meta)
      if (e.key === 'Meta') { e.preventDefault(); return; }
      // Esc — cegah keluar fullscreen / tutup dialog
      if (e.key === 'Escape') { e.preventDefault(); return; }
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
    }

    // Re-enter fullscreen jika siswa keluar (Esc, browser button, dll)
    function handleFullscreenChange() {
      const isFs = !!(
        document.fullscreenElement ||
        (document as unknown as Record<string, unknown>).webkitFullscreenElement ||
        (document as unknown as Record<string, unknown>).mozFullScreenElement
      );
      if (!isFs) {
        // Tunggu sebentar lalu minta fullscreen lagi
        setTimeout(() => {
          const el = document.documentElement;
          if (el.requestFullscreen) {
            el.requestFullscreen().catch(() => {});
          } else if ((el as unknown as Record<string, () => Promise<void>>).webkitRequestFullscreen) {
            (el as unknown as Record<string, () => Promise<void>>).webkitRequestFullscreen().catch(() => {});
          }
        }, 300);
      }
    }

    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('contextmenu', handleContextMenu, true);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('contextmenu', handleContextMenu, true);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    };
  }, [phase, submitted]);

  const handleAutoSubmit = useCallback(async () => {
    // [AUTH-01+02] Mutex — cegah double submit jika timer 1s dan re-sync 10s
    // terpicu bersamaan saat sisa waktu = 0
    if (submittingRef.current) return;
    submittingRef.current = true;

    const ses = sessionRef.current;
    if (!ses) { submittingRef.current = false; return; }

    // Tampilkan notif dulu sebelum fetch — UX lebih baik
    setNotify({ msg: 'Waktu ujian telah habis. Jawaban kamu otomatis dikumpulkan.', type: 'warning' });

    try {
      const res = await fetch('/api/nilai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: ses.id }),
      });

      if (!res.ok) {
        // Fetch gagal — reset mutex, biarkan siswa submit manual
        setNotify({ msg: 'Gagal mengumpulkan jawaban otomatis. Silakan kumpulkan manual.', type: 'warning' });
        submittingRef.current = false;
        return;
      }

      // Berhasil — baru clear timer dan set submitted
      if (timerRef.current) clearInterval(timerRef.current);
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);
      setTimeLeft(0);
      setSubmitted(true);
      setTimeout(() => router.replace('/siswa/dashboard'), 3000);
    } catch {
      // Network error — reset mutex, jangan matikan timer, biarkan siswa submit manual
      setNotify({ msg: 'Gagal mengumpulkan jawaban otomatis. Silakan kumpulkan manual.', type: 'warning' });
      submittingRef.current = false;
    }
  }, [router]);

  // Resume session yang sudah berlangsung (saat refresh/reconnect)
  async function resumeExam(ses: SessionUjian) {
    // ── Hitung sisa waktu dari deadline (single source of truth) ──
    // Jangan pakai sisa_waktu dari DB — waktu tetap berjalan di server
    // meski client mati/disconnect. deadline adalah nilai yang tidak berubah.
    const sisaWaktu = Math.max(
      0,
      Math.floor((new Date(ses.deadline).getTime() - Date.now()) / 1000)
    );

    // Jika deadline sudah lewat, langsung auto-submit tanpa load soal
    if (sisaWaktu <= 0) {
      const submitRes = await fetch('/api/nilai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: ses.id }),
      });
      // Tetap redirect meski gagal — session sudah expired, tidak ada yang bisa dilakukan
      if (!submitRes.ok) console.error('Auto-submit expired session gagal:', submitRes.status);
      router.replace('/siswa/dashboard');
      return;
    }

    // Ambil id_ujian dari jadwal
    const jadwalRes = await fetch(`/api/jadwal/${jadwalId}`);
    const jadwalData = await jadwalRes.json();
    const idUjian = jadwalData.id_ujian;
    if (!idUjian) return;

    // Set jadwal/ujian info
    setJadwalInfo(jadwalData);
    if (jadwalData.ujians) setUjianInfo(jadwalData.ujians);

    // Ambil soal
    const soalRes = await fetch(`/api/soal/${idUjian}`);
    const allSoals: Soal[] = await soalRes.json();
    if (!allSoals.length) return;

    const orderedSoals = (ses.urutan_soal as string[])
      .map((id: string) => allSoals.find(s => s.id === id))
      .filter(Boolean) as Soal[];

    // Ambil jawaban yang sudah ada
    const jawRes = await fetch(`/api/jawaban?sessionId=${ses.id}`);
    const jawabanList: Jawaban[] = await jawRes.json();
    const jawMap: Record<string, Jawaban> = {};
    jawabanList.forEach(j => { jawMap[j.id_soal] = j; });

    // Restore ke soal terakhir yang dikerjakan (index soal terakhir yang ada jawabannya)
    const lastAnsweredIndex = orderedSoals.reduce((lastIdx, soal, idx) => {
      return jawMap[soal.id] ? idx : lastIdx;
    }, 0);

    setSession(ses);
    setSoalList(orderedSoals);
    setJawaban(jawMap);
    setCurrentIndex(lastAnsweredIndex);
    setTimeLeft(sisaWaktu);
    setPhase('exam');
  }

  async function handleStartExam() {
    if (!siswa) return;
    setStartError('');
    setStartLoading(true);
    try {
      // Cek session yang sudah ada
      const sesRes = await fetch(`/api/session?siswaId=${siswa.id}&jadwalId=${jadwalId}`);
      const existing: SessionUjian | null = await sesRes.json();

      if (existing && (existing.status === 'selesai' || existing.status === 'force_submit')) {
        setStartError('Kamu sudah menyelesaikan ujian ini.'); return;
      }

      let ses = existing && existing.status === 'berlangsung' ? existing : null;
      if (!ses) {
        const createRes = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siswaId: siswa.id, jadwalId }),
        });
        if (!createRes.ok) {
          const err = await createRes.json();
          setStartError(err.error ?? 'Gagal memulai ujian.'); return;
        }
        ses = await createRes.json();
      }

      if (!ses) { setStartError('Gagal memulai ujian.'); return; }

      // Ambil id_ujian dari jadwal
      const jadwalRes = await fetch(`/api/jadwal/${jadwalId}`);
      const jadwalData = await jadwalRes.json();
      const idUjian = jadwalData.id_ujian;
      if (!idUjian) { setStartError('Ujian tidak ditemukan.'); return; }

    // Ambil soal dari API
    const soalRes = await fetch(`/api/soal/${idUjian}`);
    const allSoals: Soal[] = await soalRes.json();
    if (allSoals.length === 0) { setStartError('Belum ada soal untuk ujian ini.'); return; }

    // Urutkan soal sesuai urutan_soal di session
    const orderedSoals = (ses.urutan_soal as string[])
      .map((id: string) => allSoals.find(s => s.id === id))
      .filter(Boolean) as Soal[];

    // Ambil jawaban yang sudah ada
    const jawRes = await fetch(`/api/jawaban?sessionId=${ses.id}`);
    const jawabanList: Jawaban[] = await jawRes.json();
    const jawMap: Record<string, Jawaban> = {};
    jawabanList.forEach(j => { jawMap[j.id_soal] = j; });

    // ── Selalu hitung sisa waktu dari deadline (single source of truth) ──
    // sisa_waktu di DB hanya backup, bukan sumber kebenaran.
    // deadline tidak pernah berubah sejak session dibuat.
    const sisaWaktu = Math.max(
      0,
      Math.floor((new Date(ses.deadline).getTime() - Date.now()) / 1000)
    );

    // Jika deadline sudah lewat, langsung auto-submit
    if (sisaWaktu <= 0) {
      await fetch('/api/nilai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: ses.id }),
      });
      router.replace('/siswa/dashboard');
      return;
    }

    // Restore ke soal terakhir yang dikerjakan
    const lastAnsweredIndex = orderedSoals.reduce((lastIdx, soal, idx) => {
      return jawMap[soal.id] ? idx : lastIdx;
    }, 0);

    setSession(ses);
    setSoalList(orderedSoals);
    setJawaban(jawMap);
    setCurrentIndex(lastAnsweredIndex);
    setTimeLeft(sisaWaktu);
    setPhase('exam');
    } catch {
      setStartError('Terjadi kesalahan. Coba lagi.');
    } finally {
      setStartLoading(false);
    }
  }

  async function handleSelectJawaban(soalId: string, opsiKey: JawabanBenar) {
    if (!session || submitted) return;
    const prev = jawaban[soalId];
    const status: StatusSoal = prev?.status_soal === 'ragu' ? 'ragu' : 'sudah';

    // B-04: Update UI optimistis dulu agar responsif, lalu konfirmasi ke server.
    // Jika server gagal, revert state ke nilai sebelumnya.
    const newJawaban: Jawaban = {
      ...(prev ?? {}),
      id: prev?.id ?? `jw_${soalId}`,
      id_session: session.id,
      id_soal: soalId,
      jawaban_siswa: opsiKey,
      benar_salah: null,
      waktu_jawab: new Date().toISOString(),
      status_soal: status,
    };
    setJawaban(p => ({ ...p, [soalId]: newJawaban }));

    try {
      const res = await fetch('/api/jawaban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, soalId, jawaban_siswa: opsiKey, status_soal: status }),
      });
      if (!res.ok) {
        // Revert ke state sebelumnya jika gagal
        setJawaban(p => {
          const reverted = { ...p };
          if (prev) reverted[soalId] = prev;
          else delete reverted[soalId];
          return reverted;
        });
        setNotify({ msg: 'Gagal menyimpan jawaban. Coba lagi.', type: 'warning' });
      }
    } catch {
      // Network error — revert
      setJawaban(p => {
        const reverted = { ...p };
        if (prev) reverted[soalId] = prev;
        else delete reverted[soalId];
        return reverted;
      });
      setNotify({ msg: 'Gagal menyimpan jawaban. Periksa koneksi.', type: 'warning' });
    }
  }

  async function handleToggleRagu(soalId: string) {
    if (!session || submitted) return;
    const prev = jawaban[soalId];
    const newStatus: StatusSoal = prev?.status_soal === 'ragu' ? 'sudah' : 'ragu';

    // B-04: Optimistic update dengan revert jika gagal
    setJawaban(p => ({ ...p, [soalId]: { ...p[soalId], status_soal: newStatus } as Jawaban }));

    try {
      const res = await fetch('/api/jawaban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id, soalId, jawaban_siswa: prev?.jawaban_siswa ?? null, status_soal: newStatus }),
      });
      if (!res.ok) {
        // Revert
        setJawaban(p => ({ ...p, [soalId]: { ...p[soalId], status_soal: prev?.status_soal ?? 'belum' } as Jawaban }));
        setNotify({ msg: 'Gagal menyimpan status ragu. Coba lagi.', type: 'warning' });
      }
    } catch {
      setJawaban(p => ({ ...p, [soalId]: { ...p[soalId], status_soal: prev?.status_soal ?? 'belum' } as Jawaban }));
      setNotify({ msg: 'Gagal menyimpan status ragu. Periksa koneksi.', type: 'warning' });
    }
  }

  async function handleSubmit() {
    if (!session || submitLoading) return;
    setSubmitLoading(true);
    try {
      // BUG FIX: jangan blokir submit jika ada soal kosong — cukup warning di modal
      // Soal kosong tetap boleh dikumpulkan, warning sudah ditampilkan di modal confirm

      if (timerRef.current) clearInterval(timerRef.current);
      if (saveTimerRef.current) clearInterval(saveTimerRef.current);

      const res = await fetch('/api/nilai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (!res.ok) {
        setNotify({ msg: 'Gagal mengumpulkan jawaban. Coba lagi.', type: 'warning' });
        return;
      }
      setSubmitted(true);
      setShowConfirm(false);
      setEmptyWarning('');
      router.replace('/siswa/dashboard');
    } catch {
      setNotify({ msg: 'Gagal mengumpulkan jawaban. Coba lagi.', type: 'warning' });
    } finally {
      setSubmitLoading(false);
    }
  }

  // ── Helpers ──────────────────────────────────────────────────

  function formatTime(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function getSoalStatus(soalId: string): StatusSoal {
    return (jawaban[soalId]?.status_soal as StatusSoal) ?? 'belum';
  }

  function getNavClass(soalId: string, idx: number) {
    const status = getSoalStatus(soalId);
    const isActive = idx === currentIndex;
    let cls = 'soal-nav-btn ';
    if (status === 'sudah') cls += 'soal-nav-sudah';
    else if (status === 'ragu') cls += 'soal-nav-ragu';
    else cls += 'soal-nav-belum';
    if (isActive) cls += ' soal-nav-aktif';
    return cls;
  }

  function getOpsiText(soal: Soal, opsiKey: JawabanBenar): string {
    const map: Record<JawabanBenar, string> = {
      A: soal.opsi_a, B: soal.opsi_b, C: soal.opsi_c, D: soal.opsi_d, E: '',
    };
    return map[opsiKey];
  }

  function getOpsiImg(soal: Soal, opsiKey: JawabanBenar): string | undefined {
    const map: Record<JawabanBenar, string | undefined> = {
      A: soal.opsi_a_img, B: soal.opsi_b_img, C: soal.opsi_c_img, D: soal.opsi_d_img, E: undefined,
    };
    return map[opsiKey];
  }

  // Get shuffled opsi for current soal
  function getShuffledOpsi(soal: Soal): { displayKey: JawabanBenar; originalKey: JawabanBenar; text: string; img?: string }[] {
    if (!session) return [];
    const opsiUrutan = session.urutan_opsi[soal.id] ?? (['A','B','C','D','E'] as JawabanBenar[]);
    const displayKeys: JawabanBenar[] = ['A','B','C','D','E'];
    // BUG FIX: filter opsi yang teksnya kosong (opsi E tidak digunakan)
    return displayKeys.map((displayKey, idx) => ({
      displayKey,
      originalKey: opsiUrutan[idx],
      text: getOpsiText(soal, opsiUrutan[idx]),
      img: getOpsiImg(soal, opsiUrutan[idx]),
    })).filter(o => o.text.trim() !== '');
  }

  const currentSoal = soalList[currentIndex];
  const dijawab = Object.values(jawaban).filter(j => j.jawaban_siswa !== null).length;
  const ragu    = Object.values(jawaban).filter(j => j.status_soal === 'ragu').length;
  const kosong  = soalList.length - dijawab;
  const timeWarning = timeLeft <= 300; // 5 menit

  // ── Render: Confirm Phase ──────────────────────────────────

  if (phase === 'confirm') {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'var(--color-bg)' }}>
        <div style={{ position: 'fixed', top: '1rem', right: '1rem' }}><ThemeToggle /></div>
        <div className="card" style={{ width: '100%', maxWidth: 440 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.25rem' }}>
            {ujianInfo?.nama_ujian ?? 'Mulai Ujian'}
          </h2>
          {ujianInfo && jadwalInfo && (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 1.25rem' }}>
              {/* durasi_menit ADA di jadwal_ujians di DB */}
              Durasi: {jadwalInfo.durasi_menit} menit
            </p>
          )}
          {startError && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{startError}</div>
          )}
          <div className="alert alert-warning" style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>
            Pastikan kamu siap. Timer dimulai segera setelah ujian dimulai.
          </div>
          <button onClick={handleStartExam} className="btn btn-primary btn-lg" style={{ width: '100%', marginBottom: '0.75rem' }} disabled={startLoading}>
            {startLoading ? 'Memulai ujian...' : 'Mulai Ujian'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.back()} disabled={startLoading}>
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Exam Phase ─────────────────────────────────────

  if (phase !== 'exam' || !currentSoal || !session) return null;

  const shuffledOpsi = getShuffledOpsi(currentSoal);
  const selectedDisplayKey = jawaban[currentSoal.id]?.jawaban_siswa ?? null;

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)' }}>
      {/* Topbar Ujian */}
      <header className="topbar" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
            {ujianInfo?.nama_ujian ?? 'Ujian'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          {/* Timer */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.375rem',
            padding: '0.3125rem 0.75rem',
            borderRadius: 'var(--radius-full)',
            background: timeWarning ? 'var(--color-danger-bg)' : 'var(--color-surface-raised)',
            border: `1.5px solid ${timeWarning ? 'var(--color-danger)' : 'var(--color-border)'}`,
            color: timeWarning ? 'var(--color-danger)' : 'var(--color-text)',
            fontWeight: 700, fontFamily: 'var(--font-geist-mono), monospace',
            fontSize: '0.9375rem',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            {formatTime(timeLeft)}
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Empty warning */}
      {emptyWarning && (
        <div style={{
          background: 'var(--color-warning-bg)',
          borderBottom: '2px solid var(--color-warning)',
          padding: '0.625rem 1.5rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: 'var(--color-warning)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
        }}>
          <span>{emptyWarning}</span>
          <button onClick={() => setEmptyWarning('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-warning)', fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Notifikasi force submit / waktu habis */}
      {notify && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 500,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'var(--color-surface)',
            border: `2px solid ${notify.type === 'warning' ? 'var(--color-warning)' : 'var(--color-primary)'}`,
            borderRadius: '0.875rem',
            padding: '2rem 2.5rem',
            maxWidth: 400,
            textAlign: 'center',
            boxShadow: 'var(--shadow-xl)',
          }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
              {notify.type === 'warning' ? '⏰' : 'ℹ️'}
            </div>
            <p style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text)', lineHeight: 1.6 }}>
              {notify.msg}
            </p>
            <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Kamu akan diarahkan ke dashboard dalam beberapa detik...
            </p>
          </div>
        </div>
      )}

      {/* Body: soal + panel */}
      <div className="exam-body">
        {/* Area Soal */}
        <main style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Nomor + bobot */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>
              Soal {currentIndex + 1} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>dari {soalList.length}</span>
            </span>
            <span className="badge badge-neutral">Bobot: {currentSoal.bobot}</span>
          </div>

          {/* Pertanyaan */}
          <div className="card" style={{ padding: '1.25rem', lineHeight: 1.7, fontSize: '0.9375rem' }}>
            {currentSoal.gambar_url && (
              <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                <img
                  src={currentSoal.gambar_url}
                  alt="Gambar soal"
                  style={{
                    maxWidth: '100%', maxHeight: 280,
                    objectFit: 'contain', borderRadius: 8,
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-surface-raised)',
                  }}
                />
              </div>
            )}
            <p style={{ margin: 0 }}><RichText text={currentSoal.pertanyaan} /></p>
          </div>

          {/* Opsi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {shuffledOpsi.map(({ displayKey, text, img }) => (
              <button
                key={displayKey}
                className={`opsi-item${selectedDisplayKey === displayKey ? ' selected' : ''}`}
                onClick={() => handleSelectJawaban(currentSoal.id, displayKey)}
                disabled={submitted}
                style={{ alignItems: img ? 'flex-start' : undefined }}
              >
                <span className="opsi-label">{displayKey}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <RichText text={text ?? ''} />
                  {img && (
                    <img
                      src={img}
                      alt={`Gambar opsi ${displayKey}`}
                      style={{
                        display: 'block',
                        marginTop: '0.5rem',
                        maxWidth: '100%',
                        maxHeight: 160,
                        objectFit: 'contain',
                        borderRadius: 6,
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-surface-raised)',
                      }}
                    />
                  )}
                </span>
              </button>
            ))}
          </div>

          {/* Aksi soal */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              className={`btn btn-sm ${getSoalStatus(currentSoal.id) === 'ragu' ? 'btn-secondary' : 'btn-outline'}`}
              onClick={() => handleToggleRagu(currentSoal.id)}
              disabled={submitted}
            >
              {getSoalStatus(currentSoal.id) === 'ragu' ? 'Batalkan Ragu-ragu' : 'Tandai Ragu-ragu'}
            </button>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                disabled={currentIndex === 0}
              >
                ← Sebelumnya
              </button>
              {currentIndex < soalList.length - 1 ? (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setCurrentIndex(i => Math.min(soalList.length - 1, i + 1))}
                >
                  Berikutnya →
                </button>
              ) : (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    if (kosong > 0) {
                      const firstEmpty = soalList.findIndex(s => !jawaban[s.id]?.jawaban_siswa);
                      if (firstEmpty !== -1) setCurrentIndex(firstEmpty);
                      setEmptyWarning(`Masih ada ${kosong} soal yang belum dijawab. Silakan lengkapi terlebih dahulu.`);
                      return;
                    }
                    setEmptyWarning('');
                    setShowConfirm(true);
                  }}
                  disabled={submitted}
                >
                  Selesai & Kumpulkan
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Panel Navigasi */}
        <aside className="exam-nav-panel" style={{
          backgroundColor: 'var(--color-surface)',
          borderLeft: '1px solid var(--color-border-subtle)',
          padding: '1rem',
          overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '1rem',
        }}>
          {/* Ringkasan */}
          <div style={{ fontSize: '0.8125rem' }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.5rem' }}>Ringkasan</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--color-text-muted)' }}>
              <span style={{ color: 'var(--color-success)' }}>● {dijawab} Dijawab</span>
              <span style={{ color: '#92610a' }}>● {ragu} Ragu-ragu</span>
              <span>● {kosong} Belum dijawab</span>
            </div>
          </div>

          <div className="divider" style={{ margin: '0' }} />

          {/* Grid nomor soal */}
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.625rem' }}>Navigasi Soal</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.375rem' }}>
              {soalList.map((soal, idx) => (
                <button
                  key={soal.id}
                  className={getNavClass(soal.id, idx)}
                  onClick={() => setCurrentIndex(idx)}
                  title={`Soal ${idx + 1}`}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Legenda */}
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-subtle)', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            <span style={{ color: 'var(--color-soal-belum)' }}>■ Belum dijawab</span>
            <span style={{ color: 'var(--color-soal-sudah)' }}>■ Sudah dijawab</span>
            <span style={{ color: 'var(--color-soal-ragu)' }}>■ Ragu-ragu</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Tombol Submit */}
          <button
            className="btn btn-primary btn-sm"
            style={{ width: '100%' }}
            onClick={() => {
              if (kosong > 0) {
                const firstEmpty = soalList.findIndex(s => !jawaban[s.id]?.jawaban_siswa);
                if (firstEmpty !== -1) setCurrentIndex(firstEmpty);
                setEmptyWarning(`Masih ada ${kosong} soal yang belum dijawab. Silakan lengkapi terlebih dahulu.`);
                return;
              }
              setEmptyWarning('');
              setShowConfirm(true);
            }}
            disabled={submitted}
          >
            Kumpulkan Jawaban
          </button>
        </aside>
      </div>

      {/* Modal Konfirmasi Submit */}
      {showConfirm && (
        <div className="modal-backdrop" onClick={() => setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)' }}>
                Kumpulkan Jawaban?
              </h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowConfirm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                {[
                  { label: 'Dijawab',     val: dijawab, color: 'var(--color-success)' },
                  { label: 'Ragu-ragu',   val: ragu,    color: 'var(--color-warning)' },
                  { label: 'Belum',       val: kosong,  color: 'var(--color-text-muted)' },
                ].map(item => (
                  <div key={item.label} className="card card-raised" style={{ textAlign: 'center', padding: '0.75rem 0.5rem' }}>
                    <div style={{ fontSize: '1.375rem', fontWeight: 700, color: item.color }}>{item.val}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.label}</div>
                  </div>
                ))}
              </div>
              {kosong > 0 && (
                <div className="alert alert-warning" style={{ fontSize: '0.875rem' }}>
                  Masih ada {kosong} soal yang belum dijawab.
                </div>
              )}
              <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                Setelah dikumpulkan, jawaban tidak dapat diubah.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)} disabled={submitLoading}>Kembali</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitLoading}>
                {submitLoading ? 'Mengumpulkan...' : 'Ya, Kumpulkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
