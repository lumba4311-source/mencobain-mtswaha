'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/features/auth/AuthProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  getStore, getJadwalAktifBySiswa, getHistoriNilai,
} from '@/lib/store';
import type { JadwalUjian, Nilai, Ujian } from '@/types';

export default function SiswaDashboard() {
  const { user, siswa, logout } = useAuth();
  const router = useRouter();
  const [jadwalAktif, setJadwalAktif] = useState<JadwalUjian[]>([]);
  const [histori, setHistori] = useState<Nilai[]>([]);
  const [ujianMap, setUjianMap] = useState<Record<string, Ujian>>({});

  useEffect(() => {
    if (!user || user.role !== 'siswa' || !siswa) {
      router.replace('/login');
      return;
    }
    const store = getStore();
    const aktif = getJadwalAktifBySiswa(siswa.id);
    const hist  = getHistoriNilai(siswa.id);
    const map: Record<string, Ujian> = {};
    store.ujians.forEach(u => { map[u.id] = u; });
    setJadwalAktif(aktif);
    setHistori(hist);
    setUjianMap(map);
  }, [user, siswa, router]);

  if (!user || !siswa) return null;

  const store = getStore();
  const kelasMap: Record<string, string> = {};
  store.kelas.forEach(k => { kelasMap[k.id] = k.nama_kelas; });
  const mapelMap: Record<string, string> = {};
  store.mataPelajaran.forEach(m => { mapelMap[m.id] = m.nama_mapel; });

  function statusBadgeClass(status: string) {
    if (status === 'Dibuka')   return 'badge badge-success';
    if (status === 'Menunggu') return 'badge badge-warning';
    return 'badge badge-neutral';
  }

  function nilaiColor(nilai: number, kkm: number) {
    return nilai >= kkm ? 'var(--color-success)' : 'var(--color-danger)';
  }

  return (
    <div style={{ minHeight: '100dvh', backgroundColor: 'var(--color-bg)' }}>
      {/* Topbar */}
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flex: 1 }}>
          <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-full)', background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-text)' }}>E-CBT MTS WAHA</span>
          <span style={{ color: 'var(--color-border)', fontSize: '1rem' }}>|</span>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Dashboard Siswa</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>{user.nama}</span>
          <ThemeToggle />
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); router.replace('/login'); }}>Keluar</button>
        </div>
      </header>

      {/* Content */}
      <main className="page-container" style={{ paddingTop: '1.5rem' }}>
        {/* Profil Singkat */}
        <div className="card" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius-full)', background: 'var(--color-primary-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{siswa.nama}</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              NIS: {siswa.nis} &nbsp;·&nbsp; Kelas: {kelasMap[siswa.id_kelas] ?? '-'}
            </div>
          </div>
          <span className="badge badge-primary">Siswa</span>
        </div>

        {/* Jadwal Aktif */}
        <section style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem', marginTop: 0 }}>
            Ujian Tersedia
          </h2>
          {jadwalAktif.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              Tidak ada ujian aktif saat ini.
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.875rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {jadwalAktif.map(jadwal => {
                const ujian = ujianMap[jadwal.id_ujian];
                const mapelNama = ujian ? mapelMap[ujian.id_mapel] : '-';
                return (
                  <div key={jadwal.id} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: '0.25rem' }}>
                          {ujian?.nama_ujian ?? 'Ujian'}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>{mapelNama}</div>
                      </div>
                      <span className={statusBadgeClass(jadwal.status)}>{jadwal.status}</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8125rem', color: 'var(--color-text-subtle)' }}>
                      <span>Ruangan: {jadwal.ruangan}</span>
                      <span>·</span>
                      <span>{ujian?.durasi} menit</span>
                      {ujian && <span>· KKM {ujian.nilai_kkm}</span>}
                    </div>
                    {(() => {
                      const now = Date.now();
                      const mulai = new Date(jadwal.waktu_mulai).getTime();
                      const belumWaktu = now < mulai;
                      if (jadwal.status === 'Dibuka' && !belumWaktu) {
                        return (
                          <Link
                            href={`/siswa/ujian?jadwal=${jadwal.id}`}
                            className="btn btn-primary btn-sm"
                            style={{ alignSelf: 'flex-start' }}
                          >
                            Mulai Ujian
                          </Link>
                        );
                      }
                      const label = belumWaktu
                        ? `Mulai ${new Date(jadwal.waktu_mulai).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                        : 'Belum Dibuka';
                      return <button className="btn btn-outline btn-sm" disabled>{label}</button>;
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Histori Nilai */}
        <section>
          <h2 style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--color-text)', marginBottom: '1rem', marginTop: 0 }}>
            Riwayat Ujian
          </h2>
          {histori.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
              Belum ada riwayat ujian.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Ujian</th>
                    <th>Mata Pelajaran</th>
                    <th>Benar</th>
                    <th>Salah</th>
                    <th>Kosong</th>
                    <th>Nilai</th>
                    <th>Status</th>
                    <th>Waktu Submit</th>
                  </tr>
                </thead>
                <tbody>
                  {histori.map(n => {
                    const jadwal = store.jadwalUjians.find(j => j.id === n.id_jadwal);
                    const ujian  = jadwal ? ujianMap[jadwal.id_ujian] : null;
                    const kkm    = ujian?.nilai_kkm ?? 75;
                    return (
                      <tr key={n.id}>
                        <td style={{ fontWeight: 500 }}>{ujian?.nama_ujian ?? '-'}</td>
                        <td>{ujian ? mapelMap[ujian.id_mapel] : '-'}</td>
                        <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{n.jumlah_benar}</td>
                        <td style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{n.jumlah_salah}</td>
                        <td style={{ color: 'var(--color-text-muted)' }}>{n.jumlah_kosong}</td>
                        <td>
                          <span style={{ fontWeight: 700, fontSize: '1rem', color: nilaiColor(n.nilai, kkm) }}>
                            {n.nilai.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          <span className={n.lulus ? 'badge badge-success' : 'badge badge-danger'}>
                            {n.lulus ? 'Lulus' : 'Tidak Lulus'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--color-text-muted)', fontSize: '0.8125rem' }}>
                          {new Date(n.submitted_at).toLocaleString('id-ID')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
