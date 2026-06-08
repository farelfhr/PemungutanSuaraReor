# Pemungutan Suara Digital Reorganisasi PRTA UM 2026

Aplikasi web untuk pemungutan suara digital kegiatan LPJ dan Reorganisasi PRTA UM 2026. Sistem mengikuti PRD: pemilih tidak memakai HP masing-masing, tetapi bergantian memakai laptop voting putra dan laptop voting putri. Admin membuka/menutup sesi dan display menampilkan progres real-time.

## Ringkasan Dokumen

- TOR: kegiatan LPJ dan Reorganisasi PRTA 2026 dilaksanakan Selasa, 09 Juni 2026 di Aula Asrama Tulip. Agenda pemungutan suara digital dijadwalkan 15.05-15.45.
- PRD: voting dilakukan per sesi berurutan: Ketua Umum, Wakil Ketua Putra 1, Wakil Ketua Putri 1, Wakil Ketua Putri 2.
- Data peserta: file CSV berisi 43 baris peserta. Kolom utama yang dipakai adalah `Nama Lengkap`, `Jenis Kelamin`, `Jabatan di PRTA`, `Asrama`, dan `Angkatan`.

## Asumsi Implementasi

- PRD menjadi prioritas teknis ketika TOR masih menyebut surat suara manual.
- Semua peserta dari CSV diset `is_voter = true` karena PRD/TOR tidak menyatakan kandidat harus dikecualikan dari pemilih. Admin bisa mengubahnya di `/admin/participants`.
- Semua 8 nama kandidat dari PRD ditandai `is_candidate = true`.
- Karena dokumen tidak memetakan kandidat ke jabatan tertentu, seed awal mengisi:
  - Ketua Umum: semua kandidat.
  - Wakil Ketua Putra 1: kandidat putra.
  - Wakil Ketua Putri 1 dan 2: kandidat putri.
- CSV terlihat memiliki pergeseran kolom pada `Angkatan`/`Email`; script seed akan mengosongkan `generation` jika nilainya berbentuk email dan menulis peringatan ke console.

## Stack

- Next.js, TypeScript, Tailwind CSS
- Supabase PostgreSQL, RPC, RLS, Realtime
- Admin login sederhana via `ADMIN_EMAIL` dan `ADMIN_PASSWORD`
- Deploy target: Vercel

## Routes

- `/` - halaman masuk utama
- `/admin/login` - login admin
- `/admin` - dashboard sesi, progres, hasil, export CSV
- `/admin/participants` - presensi, status pemilih, status kandidat
- `/admin/candidates` - kandidat per posisi
- `/vote/putra` - laptop voting putra
- `/vote/putri` - laptop voting putri
- `/display` - tampilan proyektor

## Setup Supabase

1. Buat project Supabase baru.
2. Buka SQL Editor.
3. Jalankan file:

```bash
supabase/migrations/202606080001_initial_schema.sql
```

Migration membuat tabel:

- `participants`
- `positions`
- `candidates`
- `voting_sessions`
- `votes`
- `voting_devices_state`

Migration juga membuat RPC:

- `submit_vote`
- `open_voting_session`
- `close_voting_session`
- `announce_session_results`

Proteksi utama database:

- `votes(session_id, participant_id)` unik agar peserta tidak bisa vote dua kali dalam sesi yang sama.
- Trigger `validate_vote_before_insert` menolak vote jika sesi tidak berjalan, peserta tidak hadir, peserta tidak berhak, atau kandidat tidak sesuai sesi.
- Trigger `prevent_vote_update` dan `prevent_vote_delete` mencegah suara diubah atau dihapus.
- Hasil kandidat tidak dibuka dari endpoint public kecuali sesi sudah `hasil_diumumkan`.

## Environment

Salin `.env.example` menjadi `.env.local`, lalu isi:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_EMAIL=
ADMIN_PASSWORD=
```

`SUPABASE_SERVICE_ROLE_KEY` hanya dipakai server/API dan script seed. Jangan expose key ini ke browser.

## Seed Data

Install dependency:

```bash
npm install
```

Jalankan seed peserta dari file terlampir:

```bash
npm run seed:participants -- --file "c:\Users\user\Downloads\Data PRTA.xlsx - 2025.csv"
```

Atau taruh file ke `data/participants.csv`, lalu jalankan:

```bash
npm run seed:participants
```

Script akan:

- membaca nama, gender, bidang, asrama, angkatan jika valid
- normalisasi gender ke `putra` atau `putri`
- menandai kandidat PRD sebagai `is_candidate = true`
- mengisi kandidat default per posisi
- menulis peringatan jika ada data tidak lengkap atau kolom bergeser

## Menjalankan Lokal

```bash
npm install
npm run dev
```

Buka:

- Admin: `http://localhost:3000/admin/login`
- Laptop putra: `http://localhost:3000/vote/putra`
- Laptop putri: `http://localhost:3000/vote/putri`
- Display: `http://localhost:3000/display`

## Flow Acara

1. Admin login.
2. Admin cek peserta dan tandai `hadir`, `tidak_hadir`, atau `belum_hadir`.
3. Admin cek kandidat per posisi.
4. Admin buka sesi pertama.
5. Operator laptop putra/putri klik atau drag peserta yang maju.
6. Peserta memilih kandidat dan konfirmasi.
7. Vote tersimpan melalui RPC `submit_vote`.
8. Dashboard dan display refresh real-time dari perubahan Supabase.
9. Admin dapat menutup sesi walaupun masih ada peserta hadir yang belum memilih.
10. Admin klik `Umumkan Hasil` agar display proyektor menampilkan hasil.

## Deploy Vercel

1. Push repository ke GitHub.
2. Import project di Vercel.
3. Set environment yang sama seperti `.env.local`.
4. Deploy.
5. Pastikan Supabase Realtime aktif untuk tabel `participants`, `positions`, `candidates`, dan `voting_sessions`.

## Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
npm run seed:participants
```
