# RuangWeb — Katalog Jasa Website

RuangWeb adalah konsep studio jasa pembuatan website berharga terjangkau untuk UMKM dan sekolah. Pelanggan memilih demo, memilih paket, lalu meminta penyesuaian berdasarkan kebutuhan. Nama RuangWeb adalah nama kerja; cek ketersediaan merek dan domain sebelum peluncuran publik.

**Static-first · HTML/CSS/JavaScript · Tanpa backend · Tanpa database · Tanpa proses build**

## Produk awal

### Demo UMKM
- `demos/umkm-kuliner.html` — kuliner, kafe, restoran, katering
- `demos/umkm-jasa.html` — laundry, bengkel, salon, jasa lokal
- `demos/umkm-profil.html` — profil bisnis dan layanan profesional

### Demo sekolah
- `demos/sekolah-paud.html` — TK dan PAUD
- `demos/sekolah-profile.html` — profil sekolah dan informasi PPDB

### Harga uji awal
- UMKM Starter: mulai Rp499.000
- UMKM Business: mulai Rp899.000
- School Profile: mulai Rp1.499.000
- Kebutuhan khusus, formulir PPDB, halaman tambahan, domain, email bisnis, konten, dan pemeliharaan dibahas terpisah.

Harga adalah titik awal pengujian, bukan jaminan harga pasar. Sebelum menerima proyek, jelaskan jumlah halaman, konten yang harus disediakan pelanggan, jumlah revisi, waktu pengerjaan, pembayaran, domain, dan biaya tambahan secara tertulis.

## Struktur proyek

```text
launchpage-kit/
├── index.html
├── assets/
│   ├── css/style.css
│   └── js/
│       ├── main.js
│       ├── site-config.js
│       ├── order.js
│       ├── word-counter.js
│       ├── text-case.js
│       └── slug-generator.js
├── demos/
│   ├── umkm-kuliner.html
│   ├── umkm-jasa.html
│   ├── umkm-profil.html
│   ├── sekolah-paud.html
│   ├── sekolah-profile.html
│   └── (demo awal lain tetap tersimpan sebagai arsip)
├── tools/
├── _headers
└── LICENSE
```

## Konfigurasi WhatsApp sebelum peluncuran

1. Buka `assets/js/site-config.js`.
2. Isi `whatsappNumber` dengan nomor bisnis dalam format internasional tanpa tanda plus atau karakter lain. Contoh format Indonesia: `62812xxxxxxx` (ganti dengan nomor bisnis yang benar).
3. Simpan perubahan dan uji tombol “Pilih desain” dari homepage dan setiap demo.
4. Pastikan pesan yang terbuka berisi kode produk dan paket yang benar.

Nomor WhatsApp belum diisi pada versi repository ini. Tombol pemesanan akan membawa pengunjung ke bagian kontak sampai nomor resmi dikonfigurasi. Jangan menaruh nomor pribadi atau nomor contoh pada website publik.

## Pratinjau lokal

Buka `index.html` di browser atau jalankan server statis sederhana dari folder root. Penggunaan server lokal biasanya memberi hasil paling akurat untuk tautan relatif.

## Deploy ke Cloudflare Pages

1. Masuk ke Cloudflare dan buka **Workers & Pages**.
2. Pilih membuat aplikasi Pages dan hubungkan repository Git.
3. Pilih `jproject777official-tech/launchpage-kit`.
4. Branch produksi: `main`.
5. Framework preset: **None**.
6. Build command: kosongkan.
7. Build output directory: root repository (sesuai petunjuk dashboard Cloudflare yang berlaku).
8. Deploy, lalu uji URL `pages.dev` sebelum menghubungkan domain khusus.

Panduan resmi: https://developers.cloudflare.com/pages/get-started/git-integration/

## Checklist sebelum menerima pesanan

- Ganti nama demo, teks, foto, dan informasi contoh dengan materi pelanggan yang sah.
- Periksa tampilan desktop dan ponsel, tautan, tombol, dan aksesibilitas dasar.
- Pastikan nomor WhatsApp bisnis benar.
- Tulis ruang lingkup, harga akhir, uang muka, tenggat, revisi, dan biaya tambahan.
- Jangan menampilkan testimoni, statistik, atau logo pelanggan yang tidak nyata.
- Untuk foto/data anak atau siswa, dapatkan izin yang sesuai sebelum publikasi.
- Formulir PPDB dengan penyimpanan data, akun, atau dashboard tidak termasuk dalam paket profil statis secara otomatis. Tinjau privasi dan keamanan sebelum membuat fitur yang memproses data pribadi.

## Catatan teknis

- Website utama dan demo katalog merupakan halaman statis. Tidak ada backend atau database.
- Tombol pemesanan memakai tautan WhatsApp dengan pesan awal yang sudah diisi, setelah nomor bisnis dikonfigurasi.
- Tools teks yang lama tetap tersimpan, tetapi bukan fokus utama katalog jasa.
- CSS menggunakan Google Fonts. Untuk menghilangkan permintaan pihak ketiga, hapus baris `@import` paling atas di `assets/css/style.css`; font fallback tetap tersedia.

## Lisensi

MIT. Lihat `LICENSE`.
