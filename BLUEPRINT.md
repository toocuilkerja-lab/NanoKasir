# Blueprint Aplikasi POS & Laporan Keuangan

Aplikasi ini adalah sistem Point of Sale (POS) lengkap dengan fitur akuntansi (Laporan Keuangan, Jurnal Umum, Manajemen Aset, dan Persediaan).

## Arsitektur & Teknologi
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS.
- **Backend/Database**: Supabase (PostgreSQL) untuk penyimpanan data.
- **State Management**: React Hooks (useState, useEffect, useMemo).
- **Icons**: Lucide React.
- **Animations**: Framer Motion (motion/react).

## Fitur Utama
1. **POS (Point of Sale)**:
   - Manajemen menu makanan/minuman.
   - Sistem antrian (Queue Number).
   - Cetak struk (Printer Utility).
   - Riwayat pesanan.

2. **Laporan Keuangan (Accounting)**:
   - **Laba Rugi**: Menghitung Pendapatan, HPP (Metode Periodik), dan Beban.
   - **Neraca**: Menampilkan Aset, Kewajiban, dan Ekuitas (termasuk Laba Ditahan otomatis).
   - **Jurnal Umum**: Pencatatan transaksi manual dengan sistem Debit/Kredit.
   - **Manajemen Aset**: Perhitungan penyusutan aset tetap (Kelompok 1-4, Bangunan) secara otomatis berdasarkan tahun yang dipilih.
   - **Persediaan**: Penyesuaian stok (Stok Opname) di akhir tahun.

3. **Logika Khusus**:
   - **Wall Clock Time**: Semua tanggal disimpan dan ditampilkan sebagai waktu lokal murni (mengabaikan UTC offset) untuk konsistensi audit.
   - **Laba Ditahan**: Dihitung secara otomatis dari akumulasi laba tahun-tahun sebelumnya.
   - **HPP Periodik**: Menggunakan rumus `Persediaan Awal + Pembelian - Persediaan Akhir`.

## Variabel Lingkungan (.env)
Aplikasi membutuhkan variabel berikut di Vercel/GitHub Secrets:
- `VITE_SUPABASE_URL`: URL proyek Supabase.
- `VITE_SUPABASE_ANON_KEY`: Anon Key Supabase.

## Prompt Re-Creation (Gunakan ini untuk project baru)
> "Buatlah aplikasi POS Full-Stack menggunakan React, Vite, Tailwind, dan Supabase. Aplikasi harus memiliki fitur:
> 1. POS dengan manajemen menu, antrian, dan cetak struk.
> 2. Modul Akuntansi lengkap: Jurnal Umum, Laba Rugi, Neraca, Manajemen Aset, dan Persediaan.
> 3. Logika Laba Rugi menggunakan metode HPP Periodik.
> 4. Neraca harus menghitung Laba Ditahan secara otomatis dari akumulasi laba tahun sebelumnya.
> 5. Manajemen Aset harus mendukung pemilihan tahun untuk melihat NB Awal, Penyusutan Tahunan, dan NB Akhir.
> 6. Semua penanganan tanggal harus menggunakan 'Wall Clock Time' (abaikan UTC offset) agar jam di database sama dengan jam lokal.
> 7. UI harus bersih, profesional, menggunakan Lucide icons, dan responsive."
