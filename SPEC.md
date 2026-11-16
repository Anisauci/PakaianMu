# SPEC: PakaianMu

Katalog dan dashboard produk UMKM baju trift berbasis web, untuk latihan 1 hari.

- Versi dokumen: 1.0
- Status: siap diimplementasikan
- Prototipe acuan: `pakaianmu-tema-baru.html` (single HTML)
- Target akhir: Vite + JavaScript vanilla

---

## 1. Tujuan

1. Menyediakan etalase digital sederhana agar calon pembeli dapat melihat produk baju trift, mencari, memfilter, mengurutkan, lalu memesan lewat WhatsApp.
2. Menyediakan dashboard demo agar pengelola toko dapat menambah, mengubah, dan menghapus produk tanpa backend.
3. Menjadi bahan latihan alur vibe coding dalam 1 hari: spesifikasi dulu, prototipe, lalu implementasi bertahap dengan pengujian manual.

Ukuran keberhasilan: seluruh acceptance criteria pada bagian 9 lulus pada satu browser desktop modern dan satu tampilan lebar ponsel.

## 2. Pengguna

| Peran | Deskripsi | Kebutuhan utama |
|---|---|---|
| Calon pembeli | Pengunjung katalog pada perangkat yang sama | Melihat produk, mencari, memfilter, mengurutkan, menghubungi penjual lewat WhatsApp |
| Pengelola toko | Pemilik UMKM pada perangkat yang sama | Mengelola produk dan kategori, melihat ringkasan, mengatur nomor WhatsApp |

Catatan: kedua peran memakai satu perangkat dan satu browser. Tidak ada login, akun, atau pembedaan hak akses. Dashboard hanya berupa tab terpisah, bukan area terproteksi. Aplikasi tidak boleh menampilkan form login palsu atau klaim keamanan yang tidak ada.

## 3. Daftar Fitur

### 3.1 Katalog (MVP)

| ID | Fitur | Deskripsi |
|---|---|---|
| F-01 | Daftar produk contoh | 8 produk contoh ditampilkan sebagai kartu saat penyimpanan masih kosong |
| F-02 | Kartu produk | Menampilkan gambar, kategori, nama, harga Rupiah, stok, deskripsi, dan penanda unggulan |
| F-03 | Placeholder gambar lokal | Jika tidak ada gambar, sistem membuat gambar SVG lokal berwarna; tanpa file atau URL gambar luar |
| F-04 | Pencarian | Mencari pada nama dan deskripsi, tidak peka huruf besar/kecil |
| F-05 | Filter kategori | Dropdown "Semua Kategori" dan kategori yang tersedia |
| F-06 | Sorting | Unggulan dulu, Nama A-Z, Harga terendah, Harga tertinggi, Stok terbanyak |
| F-07 | Tombol pesan WhatsApp | Membuka `https://wa.me/<nomor>?text=<pesan>` di tab baru dengan pesan berisi nama dan harga produk |
| F-08 | Label stok | Stok rendah (1 sampai 2) dan stok habis (0) diberi tanda visual berbeda |
| F-09 | Keadaan kosong | Pesan "Produk tidak ditemukan." jika hasil pencarian atau filter kosong |

### 3.2 Dashboard (MVP)

| ID | Fitur | Deskripsi |
|---|---|---|
| F-10 | Ringkasan | Total produk, total stok, dan total kategori |
| F-11 | Tambah produk | Form dengan validasi; produk baru muncul di urutan teratas |
| F-12 | Edit produk | Form terisi data produk terpilih; tombol berubah menjadi "Perbarui" |
| F-13 | Hapus produk | Dengan dialog konfirmasi |
| F-14 | Kelola kategori | Tambah kategori (tanpa duplikat, tidak peka huruf besar/kecil); hapus hanya jika tidak dipakai produk |
| F-15 | Pengaturan nomor WhatsApp | Menyimpan nomor format internasional tanpa tanda plus |
| F-16 | Unggah gambar (opsional) | Gambar dari perangkat disimpan sebagai data URL di localStorage |

### 3.3 Pendukung

| ID | Fitur | Deskripsi |
|---|---|---|
| F-17 | Penyimpanan localStorage | Seluruh data bertahan setelah halaman dimuat ulang |
| F-18 | Mode terang/gelap | Tombol tema; pilihan disimpan di browser |

## 4. Data Model

### 4.1 Produk

| Field | Tipe | Aturan |
|---|---|---|
| `id` | string | Unik, dibuat otomatis, tidak diedit pengguna |
| `nama` | string | Wajib, tidak kosong setelah di-trim |
| `kategori` | string | Wajib, harus salah satu kategori yang tersedia |
| `harga` | number | Wajib, angka >= 0, ditampilkan dalam Rupiah tanpa desimal |
| `stok` | integer | Wajib, bilangan bulat >= 0 |
| `deskripsi` | string | Wajib, tidak kosong setelah di-trim |
| `imageUrl` | string | Data URL (placeholder SVG atau gambar unggahan); tidak boleh URL eksternal |
| `unggulan` | boolean | `true` atau `false` |

Contoh:

```json
{
  "id": "lq3k9x1ab2c",
  "nama": "Kemeja Flanel Kotak",
  "kategori": "Kemeja",
  "harga": 75000,
  "stok": 4,
  "deskripsi": "Kemeja flanel motif kotak, kondisi bersih dan nyaman dipakai.",
  "imageUrl": "data:image/svg+xml;charset=UTF-8,...",
  "unggulan": true
}
```

### 4.2 Pengaturan dan kategori

| Data | Bentuk | Aturan |
|---|---|---|
| Kategori | array of string | Unik tanpa membedakan huruf besar/kecil; diurutkan A-Z saat ditampilkan |
| Nomor WhatsApp | string angka | Hanya digit; nilai awal berupa nomor contoh nonpribadi |
| Tema | `"light"` atau `"dark"` | Opsional; bawaan mengikuti preferensi sistem |

### 4.3 Kunci localStorage

| Kunci | Isi |
|---|---|
| `pakaianmu_products_v2` | Array produk |
| `pakaianmu_categories_v1` | Array kategori |
| `pakaianmu_settings_v1` | Objek `{ "waNumber": "..." }` |
| `pakaianmu_theme_v1` | `"light"` atau `"dark"` |

### 4.4 Data contoh (8 produk)

| Nama | Kategori | Harga | Stok | Unggulan |
|---|---|---|---|---|
| Kemeja Flanel Kotak | Kemeja | 75.000 | 4 | Ya |
| Jaket Denim Klasik | Jaket | 120.000 | 2 | Ya |
| Kaos Polos Oversize | Kaos | 45.000 | 8 | Tidak |
| Celana Chino Cream | Celana | 85.000 | 3 | Tidak |
| Hoodie Zip Abu | Hoodie | 95.000 | 5 | Ya |
| Blouse Vintage Bunga | Blouse | 60.000 | 6 | Tidak |
| Sweater Rajut Cokelat | Sweater | 90.000 | 1 | Tidak |
| Rok Midi Plisket | Rok | 70.000 | 4 | Tidak |

Seluruh data contoh fiktif dan tidak memuat data pribadi.

## 5. Nonfunctional Requirements

| ID | Kategori | Persyaratan |
|---|---|---|
| N-01 | Platform | Berjalan di browser modern terbaru (Chrome, Edge, Firefox) tanpa backend |
| N-02 | Responsif | Dapat dipakai pada lebar layar 360 px sampai desktop tanpa scroll horizontal pada halaman utama |
| N-03 | Kinerja | Katalog dengan 50 produk tetap tampil dan tersaring tanpa jeda yang terasa |
| N-04 | Keamanan tampilan | Semua teks dari pengguna di-escape sebelum dimasukkan ke HTML (mencegah XSS) |
| N-05 | Keamanan data | Tidak ada API key, token, atau kredensial di kode maupun data; tidak ada login palsu |
| N-06 | Privasi | Data hanya tersimpan di browser pengguna; tidak ada pengiriman data ke server |
| N-07 | Aksesibilitas dasar | Label pada input form, kontras teks memadai di mode terang dan gelap, tombol dapat difokus keyboard |
| N-08 | Ketahanan data | Jika localStorage rusak atau tidak terbaca, aplikasi tetap berjalan dengan data contoh |
| N-09 | Lisensi aset | Tidak memakai gambar, ikon, atau font berhak cipta yang tidak berlisensi; placeholder dibuat sendiri (SVG) dan emoji sistem |
| N-10 | Lokalisasi | Antarmuka berbahasa Indonesia; format uang `Rp` dengan pemisah ribuan titik |

## 6. Risiko

| ID | Risiko | Dampak | Mitigasi |
|---|---|---|---|
| R-01 | Data hilang saat cache atau data situs dihapus | Produk kembali ke data contoh | Dokumentasikan sebagai batasan; fitur ekspor/impor masuk daftar pengembangan lanjutan |
| R-02 | Batas localStorage (sekitar 5 MB) terlampaui karena banyak gambar unggahan | Gagal menyimpan | Tampilkan pesan galat saat simpan gagal; sarankan gambar kecil; pertimbangkan pembatasan ukuran file |
| R-03 | XSS lewat nama atau deskripsi produk | Skrip berjalan di halaman | Escape semua input sebelum dirender (sudah ada di prototipe) |
| R-04 | Pengguna mengira dashboard aman | Pembeli bisa mengubah data di perangkat yang sama | Nyatakan jelas bahwa ini demo satu perangkat tanpa autentikasi |
| R-05 | Nomor WhatsApp salah format | Tautan pesan tidak terbuka | Normalisasi ke digit saja; beri contoh format; tolak nilai kosong |
| R-06 | Harga desimal atau negatif masuk | Tampilan dan pengurutan keliru | Validasi di JavaScript, bukan hanya atribut HTML |
| R-07 | Font dari Google Fonts tidak termuat saat offline | Tampilan sedikit berubah | Sediakan font cadangan sistem (sudah ada) atau gunakan font sistem saja |
| R-08 | Waktu 1 hari tidak cukup | Fitur tidak selesai | Kerjakan per iterasi; fitur tambahan (F-16, F-18) dipotong lebih dulu |
| R-09 | Perintah atau skrip berbahaya dari agen AI | Kerusakan lingkungan kerja | Gunakan rencana dulu, baca `git diff` sebelum menyetujui, jalankan hanya perintah yang dipahami |

## 7. Out-of-Scope

- Backend, database server, dan API
- Login, registrasi, peran pengguna, atau autentikasi apa pun (termasuk yang palsu)
- Keranjang belanja, checkout, pembayaran, dan ongkos kirim
- Manajemen pesanan dan riwayat transaksi
- Sinkronisasi antarperangkat
- Pengunggahan gambar ke server atau penyimpanan cloud
- Multi-bahasa dan multi-mata uang
- Analitik, SEO lanjutan, dan notifikasi
- Pengujian otomatis end-to-end (pengujian unit opsional)
- Data pelanggan atau data pribadi dalam bentuk apa pun

## 8. Batasan Proyek

1. Jangan menyimpan API key atau data sensitif di kode, prompt, maupun localStorage.
2. Jangan menjalankan perintah berbahaya (contoh: penghapusan massal, instalasi paket tidak dikenal, mengubah pengaturan sistem).
3. Data contoh harus nonpribadi.
4. Jangan memakai aset berhak cipta (foto produk bermerek, logo merek, ikon berlisensi).
5. Tech stack: Vite + JavaScript vanilla, tanpa framework dan tanpa backend.

## 9. Acceptance Criteria (pengecekan manual)

Prasyarat: buka aplikasi di browser dengan localStorage kosong (mode jendela pribadi atau hapus data situs).

### Katalog

| ID | Langkah | Hasil yang diharapkan |
|---|---|---|
| AC-01 | Buka halaman Katalog | Tepat 8 kartu produk tampil |
| AC-02 | Periksa satu kartu | Terlihat gambar, kategori, nama, harga berformat `Rp75.000`, stok, deskripsi, dan tombol WhatsApp |
| AC-03 | Periksa kartu tanpa gambar unggahan | Gambar berasal dari placeholder lokal (tanpa permintaan jaringan ke gambar luar) |
| AC-04 | Ketik "denim" pada pencarian | Hanya "Jaket Denim Klasik" tampil |
| AC-05 | Ketik "DENIM" (huruf besar) | Hasil sama dengan AC-04 |
| AC-06 | Ketik kata yang tidak ada ("zzz") | Muncul pesan "Produk tidak ditemukan." |
| AC-07 | Pilih filter kategori "Hoodie" | Hanya produk kategori Hoodie tampil |
| AC-08 | Pilih "Harga terendah" | Produk pertama adalah Kaos Polos Oversize (45.000) |
| AC-09 | Pilih "Harga tertinggi" | Produk pertama adalah Jaket Denim Klasik (120.000) |
| AC-10 | Pilih "Stok terbanyak" | Produk pertama adalah Kaos Polos Oversize (stok 8) |
| AC-11 | Pilih "Nama A-Z" | Daftar terurut alfabetis (Blouse, Celana, Hoodie, ...) |
| AC-12 | Pilih "Unggulan dulu" | 3 produk unggulan tampil paling awal |
| AC-13 | Klik "Pesan WhatsApp" | Tab baru terbuka ke `wa.me/<nomor>` dengan pesan berisi nama dan harga produk |
| AC-14 | Periksa Sweater Rajut Cokelat (stok 1) | Label stok rendah tampil |

### Dashboard

| ID | Langkah | Hasil yang diharapkan |
|---|---|---|
| AC-15 | Buka tab Dashboard | Ringkasan menampilkan Total Produk 8, Total Stok 33, Total Kategori 8 |
| AC-16 | Isi form dengan data valid lalu Simpan | Produk baru muncul di tabel dan katalog; Total Produk menjadi 9 |
| AC-17 | Kosongkan field wajib lalu Simpan | Produk tidak tersimpan; browser menolak pengiriman |
| AC-18 | Isi harga -1 atau stok 2,5 | Produk tidak tersimpan |
| AC-19 | Klik Edit pada satu produk | Form terisi data produk; judul menjadi "Edit Produk"; tombol menjadi "Perbarui" |
| AC-20 | Ubah harga lalu Perbarui | Tabel dan katalog menampilkan harga baru; jumlah produk tetap |
| AC-21 | Klik Hapus lalu batalkan dialog | Produk tetap ada |
| AC-22 | Klik Hapus lalu konfirmasi | Produk hilang; ringkasan terbarui |
| AC-23 | Tambah kategori "Aksesoris" | Kategori muncul di chip, filter, dan pilihan form; Total Kategori bertambah |
| AC-24 | Tambah kategori "aksesoris" lagi | Muncul pesan bahwa kategori sudah ada |
| AC-25 | Hapus kategori yang dipakai produk | Ditolak dengan pesan |
| AC-26 | Hapus kategori yang belum dipakai | Kategori hilang |
| AC-27 | Ganti nomor WhatsApp lalu Simpan, kembali ke katalog, klik tombol pesan | Tautan memakai nomor baru |
| AC-28 | Simpan nomor kosong atau berisi huruf saja | Muncul pesan nomor tidak valid; nomor lama tidak berubah |
| AC-29 | Unggah gambar pada form lalu simpan | Pratinjau muncul; kartu katalog memakai gambar unggahan |

### Penyimpanan dan keamanan

| ID | Langkah | Hasil yang diharapkan |
|---|---|---|
| AC-30 | Tambah satu produk lalu muat ulang halaman | Produk tetap ada |
| AC-31 | Hapus semua kunci `pakaianmu_*` di DevTools lalu muat ulang | Data contoh kembali tampil |
| AC-32 | Isi nama produk dengan `<b>uji</b>` | Teks tampil apa adanya, bukan huruf tebal |
| AC-33 | Cari kata "api", "key", "token" di seluruh kode | Tidak ada API key atau kredensial |
| AC-34 | Periksa tab Network saat memuat halaman | Tidak ada permintaan ke server data atau API; tidak ada gambar luar |

### Tampilan

| ID | Langkah | Hasil yang diharapkan |
|---|---|---|
| AC-35 | Perkecil lebar jendela ke 360 px | Tata letak satu kolom; tidak ada scroll horizontal pada halaman |
| AC-36 | Klik tombol tema | Tampilan berganti terang/gelap dan teks tetap terbaca; pilihan bertahan setelah muat ulang |

## 10. Implementation Plan per Iterasi

Perkiraan waktu total: 1 hari kerja. Setiap iterasi diakhiri uji manual di browser dan commit.

### Iterasi 0: Persiapan (sekitar 30 menit)

- Pastikan Node.js dan npm terpasang; pasang AI coding agent pilihan.
- Buat proyek: `npm create vite@latest pakaianmu -- --template vanilla`, lalu `npm install`.
- Inisialisasi git; letakkan `SPEC.md` di akar proyek.
- Selesai bila `npm run dev` menampilkan halaman awal Vite.

### Iterasi 1: Kerangka dan katalog statis (sekitar 1,5 jam)

- Pecah prototipe: `index.html`, `src/style.css`, `src/main.js`.
- Buat 8 produk contoh di `src/products.js`, dengan placeholder SVG lokal.
- Render kartu produk; format Rupiah; label stok dan penanda unggulan.
- Lulus: AC-01, AC-02, AC-03, AC-14.

### Iterasi 2: Pencarian, filter, sorting, WhatsApp (sekitar 1,5 jam)

- Pencarian, filter kategori, lima opsi sorting, keadaan kosong.
- Tautan WhatsApp dengan pesan ter-encode; nomor contoh nonpribadi di `src/config.js`.
- Lulus: AC-04 sampai AC-13.

### Iterasi 3: Penyimpanan localStorage (sekitar 1 jam)

- Modul `storage.js` dengan `try/catch` pada baca dan tulis; fallback ke data contoh.
- Muat produk, kategori, dan pengaturan saat start.
- Lulus: AC-30, AC-31.

### Iterasi 4: Dashboard CRUD dan ringkasan (sekitar 2 jam)

- Tab Dashboard; ringkasan; form tambah dan edit; tombol hapus dengan konfirmasi.
- Validasi di JavaScript: nama, deskripsi, kategori wajib; harga >= 0; stok integer >= 0.
- Fungsi `esc()` untuk semua teks dari pengguna.
- Lulus: AC-15 sampai AC-22, AC-32.

### Iterasi 5: Kategori, nomor WhatsApp, gambar (sekitar 1 jam)

- Kelola kategori (tanpa duplikat, larangan hapus jika dipakai).
- Pengaturan nomor WhatsApp dengan normalisasi.
- Unggah gambar opsional dengan penanganan galat saat penyimpanan penuh.
- Lulus: AC-23 sampai AC-29.

### Iterasi 6: Tema, responsif, pemolesan (sekitar 1 jam)

- Terapkan tema hijau-terakota; mode terang/gelap; perbaikan kontras.
- Uji lebar 360 px; periksa fokus keyboard dan label form.
- Lulus: AC-35, AC-36.

### Iterasi 7: Verifikasi akhir dan rilis (sekitar 1 jam)

- Jalankan seluruh daftar bagian 9 dari awal pada profil browser bersih.
- Periksa AC-33 dan AC-34 (tidak ada rahasia dan tidak ada permintaan luar).
- `npm run build`; uji hasil dengan `npm run preview`.
- Deploy ke hosting statis (contoh: GitHub Pages) bila diminta; commit akhir.

### Aturan kerja selama implementasi

1. Tulis spesifikasi sebelum kode.
2. Satu prompt, satu tujuan.
3. Minta rencana dulu, izinkan eksekusi sesudahnya.
4. Baca `git diff` sebelum menyetujui perubahan.
5. Uji di browser setelah setiap iterasi, lalu commit.
6. Jangan menempel API key atau data sensitif ke prompt.

## 11. Pengembangan Lanjutan (di luar MVP)

- Ekspor dan impor data produk (JSON) untuk mengurangi risiko kehilangan data
- Batas ukuran dan kompresi gambar unggahan
- Pengujian unit untuk validasi dan format Rupiah
- Halaman detail produk dan foto ganda per produk
