'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  getStore, getSoalsByUjian, getSessionBySiswaJadwal,
  createSession, upsertJawaban, submitSession,
} from '@/lib/store';
import type { Soal, SessionUjian, Jawaban, Nilai, JawabanBenar } from '@/types';

type StatusSoal = 'belum' | 'sudah' | 'ragu';

export default function ExamPage() {
  const { user, siswa } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const jadwalId = searchParams.get('jadwal') ?? '';

  const [session, setSession] = useState<SessionUjian | null>(null);
  const [soalList, setSoalList] = useState<Soal[]>([]);
  const [jawaban, setJawaban] = useState<Record<string, Jawaban>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState<Nilai | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [phase, setPhase] = useState<'confirm' | 'exam' | 'result'>('confirm');
  const [startError, setStartError] = useState('');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Guard
  useEffect(() => {
    if (!user || user.role !== 'siswa' || !siswa) {
      router.replace('/login');
    }
  }, [user, siswa, router]);

  // Timer
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, submitted]);

  const handleAutoSubmit = useCallback(() => {
    if (!session) return;
    const nilai = submitSession(session.id);
    setResult(nilai);
    setSubmitted(true);
    setPhase('result');
  }, [session]);

  function handleStartExam() {
    if (!siswa) return;
    const store = getStore();
    const jadwal = store.jadwalUjians.find(j => j.id === jadwalId);
    if (!jadwal) { setStartError('Jadwal tidak ditemukan.'); return; }
    if (jadwal.status !== 'Dibuka') { setStartError('Sesi ujian belum/sudah ditutup.'); return; }
    if (!jadwal.siswa_ids.includes(siswa.id)) { setStartError('Kamu tidak terdaftar di sesi ini.'); return; }

    // Cek kapasitas
    const activeSessions = store.sessions.filter(
      s => s.id_jadwal === jadwalId && s.status === 'berlangsung'
    ).length;
    if (activeSessions >= jadwal.max_capacity) { setStartError('Kapasitas sesi penuh.'); return; }

    // Cek sudah pernah submit
    const existing = getSessionBySiswaJadwal(siswa.id, jadwalId);
    if (existing && (existing.status === 'selesai' || existing.status === 'force_submit')) {
      setStartError('Kamu sudah menyelesaikan ujian ini.'); return;
    }

    const soals = getSoalsByUjian(jadwal.id_ujian);
    if (soals.length === 0) { setStartError('Belum ada soal untuk ujian ini.'); return; }

    let ses = existing && existing.status === 'berlangsung' ? existing : null;
    if (!ses) ses = createSession(siswa.id, jadwal, soals);

    // Build ordered soal list
    const orderedSoals = ses.urutan_soal.map(id => soals.find(s => s.id === id)!).filter(Boolean);

    // Build jawaban map from store
    const jawMap: Record<string, Jawaban> = {};
    store.jawabans.filter(j => j.id_session === ses!.id).forEach(j => { jawMap[j.id_soal] = j; });

    // Recalculate time left
    const now = Date.now();
    const deadline = new Date(ses.deadline).getTime();
    const remaining = Math.max(0, Math.floor((deadline - now) / 1000));

    setSession(ses);
    setSoalList(orderedSoals);
    setJawaban(jawMap);
    setTimeLeft(remaining);
    setPhase('exam');
  }

  function handleSelectJawaban(soalId: string, opsiKey: JawabanBenar) {
    if (!session || submitted) return;
    const prev = jawaban[soalId];
    const status: StatusSoal = prev?.status_soal === 'ragu' ? 'ragu' : 'sudah';
    upsertJawaban(session.id, soalId, opsiKey, status);
    setJawaban(prev => ({
      ...prev,
      [soalId]: {
        ...(prev[soalId] ?? {}),
        id: `jw_${soalId}`,
        id_session: session.id,
        id_soal: soalId,
        jawaban_siswa: opsiKey,
        benar_salah: null,
        waktu_jawab: new Date().toISOString(),
        status_soal: status,
      },
    }));
  }

  function handleToggleRagu(soalId: string) {
    if (!session || submitted) return;
    const prev = jawaban[soalId];
    const newStatus: StatusSoal = prev?.status_soal === 'ragu' ? 'sudah' : 'ragu';
    upsertJawaban(session.id, soalId, prev?.jawaban_siswa ?? null, newStatus);
    setJawaban(p => ({ ...p, [soalId]: { ...p[soalId], status_soal: newStatus } as Jawaban }));
  }

  function handleSubmit() {
    if (!session) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const nilai = submitSession(session.id);
    setResult(nilai);
    setSubmitted(true);
    setShowConfirm(false);
    setPhase('result');
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
      A: soal.opsi_a, B: soal.opsi_b, C: soal.opsi_c, D: soal.opsi_d, E: soal.opsi_e,
    };
    return map[opsiKey];
  }

  // Get shuffled opsi for current soal
  function getShuffledOpsi(soal: Soal): { displayKey: JawabanBenar; originalKey: JawabanBenar; text: string }[] {
    if (!session) return [];
    const opsiUrutan = session.urutan_opsi[soal.id] ?? (['A','B','C','D','E'] as JawabanBenar[]);
    const displayKeys: JawabanBenar[] = ['A','B','C','D','E'];
    return displayKeys.map((displayKey, idx) => ({
      displayKey,
      originalKey: opsiUrutan[idx],
      text: getOpsiText(soal, opsiUrutan[idx]),
    }));
  }

  const currentSoal = soalList[currentIndex];
  const dijawab = Object.values(jawaban).filter(j => j.jawaban_siswa !== null).length;
  const ragu    = Object.values(jawaban).filter(j => j.status_soal === 'ragu').length;
  const kosong  = soalList.length - dijawab;
  const timeWarning = timeLeft <= 300; // 5 menit

  // ── Render: Confirm Phase ──────────────────────────────────

  if (phase === 'confirm') {
    const store = getStore();
    const jadwal = store.jadwalUjians.find(j => j.id === jadwalId);
    const ujian  = jadwal ? store.ujians.find(u => u.id === jadwal.id_ujian) : null;
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'var(--color-bg)' }}>
        <div style={{ position: 'fixed', top: '1rem', right: '1rem' }}><ThemeToggle /></div>
        <div className="card" style={{ width: '100%', maxWidth: 440 }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text)', margin: '0 0 0.25rem' }}>
            {ujian?.nama_ujian ?? 'Mulai Ujian'}
          </h2>
          {ujian && (
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', margin: '0 0 1.25rem' }}>
              Durasi: {ujian.durasi} menit &nbsp;·&nbsp; KKM: {ujian.nilai_kkm} &nbsp;·&nbsp; Ruangan: {jadwal?.ruangan}
            </p>
          )}
          {startError && (
            <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>{startError}</div>
          )}
          <div className="alert alert-warning" style={{ fontSize: '0.8125rem', marginBottom: '1rem' }}>
            Pastikan kamu siap. Timer dimulai segera setelah ujian dimulai.
          </div>
          <button onClick={handleStartExam} className="btn btn-primary btn-lg" style={{ width: '100%', marginBottom: '0.75rem' }}>
            Mulai Ujian
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => router.back()}>
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // ── Render: Result Phase ───────────────────────────────────

  if (phase === 'result' && result) {
    const store = getStore();
    const jadwal = store.jadwalUjians.find(j => j.id === jadwalId);
    const ujian  = jadwal ? store.ujians.find(u => u.id === jadwal.id_ujian) : null;
    const tampilHasil = ujian?.tampil_hasil ?? true;

    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backgroundColor: 'var(--color-bg)' }}>
        <div style={{ position: 'fixed', top: '1rem', right: '1rem' }}><ThemeToggle /></div>
        <div className="card" style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 'var(--radius-full)',
            background: result.lulus ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem',
          }}>
            {result.lulus ? (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-success)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            ) : (
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            )}
          </div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, margin: '0 0 0.25rem', color: 'var(--color-text)' }}>
            Ujian Selesai
          </h2>
          <p style={{ color: 'var(--color-text-muted)', margin: '0 0 1.5rem', fontSize: '0.9375rem' }}>
            {ujian?.nama_ujian}
          </p>

          {tampilHasil ? (
            <>
              <div style={{
                fontSize: '3rem', fontWeight: 800,
                color: result.lulus ? 'var(--color-success)' : 'var(--color-danger)',
                lineHeight: 1, marginBottom: '0.5rem',
              }}>
                {result.nilai.toFixed(2)}
              </div>
              <span className={result.lulus ? 'badge badge-success' : 'badge badge-danger'} style={{ fontSize: '0.9375rem', padding: '0.375rem 1rem' }}>
                {result.lulus ? 'Lulus' : 'Tidak Lulus'}
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', margin: '1.5rem 0' }}>
                {[
                  { label: 'Benar',  val: result.jumlah_benar,  color: 'var(--color-success)' },
                  { label: 'Salah',  val: result.jumlah_salah,  color: 'var(--color-danger)' },
                  { label: 'Kosong', val: result.jumlah_kosong, color: 'var(--color-text-muted)' },
                ].map(item => (
                  <div key={item.label} className="card card-raised" style={{ padding: '0.875rem 0.5rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: item.color }}>{item.val}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{item.label}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="alert alert-info" style={{ margin: '1rem 0 1.5rem' }}>
              Hasil ujian akan ditampilkan setelah seluruh sesi ditutup oleh proktor.
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => router.replace('/siswa/dashboard')}>
            Kembali ke Dashboard
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
            {getStore().ujians.find(u => u.id === getStore().jadwalUjians.find(j => j.id === jadwalId)?.id_ujian)?.nama_ujian ?? 'Ujian'}
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

      {/* Body: soal + panel */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 220px', gap: 0, maxWidth: '100%', overflow: 'hidden' }}>
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
            {currentSoal.pertanyaan}
          </div>

          {/* Opsi */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {shuffledOpsi.map(({ displayKey, text }) => (
              <button
                key={displayKey}
                className={`opsi-item${selectedDisplayKey === displayKey ? ' selected' : ''}`}
                onClick={() => handleSelectJawaban(currentSoal.id, displayKey)}
                disabled={submitted}
              >
                <span className="opsi-label">{displayKey}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>{text}</span>
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
                  onClick={() => setShowConfirm(true)}
                  disabled={submitted}
                >
                  Selesai & Kumpulkan
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Panel Navigasi */}
        <aside style={{
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
            onClick={() => setShowConfirm(true)}
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
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Kembali</button>
              <button className="btn btn-primary" onClick={handleSubmit}>Ya, Kumpulkan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
