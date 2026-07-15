# Kalenderku - Kalender Indonesia Up-to-Date 📅🇮🇩

[![Live Demo](https://img.shields.io/badge/Lihat_Live_Demo-Buka_Aplikasi-0ea5e9?style=for-the-badge&logo=safari&logoColor=white)](https://kalender-id.pages.dev/)
<br>
**Akses langsung aplikasi web di sini: [https://kalender-id.pages.dev/](https://kalender-id.pages.dev/)**

Kalenderku adalah aplikasi web interaktif yang menampilkan kalender Indonesia lengkap dengan hari libur nasional dan cuti bersama dari tahun 2000 hingga tahun-tahun mendatang. Proyek ini dibangun untuk berjalan super cepat dengan memanfaatkan infrastruktur Cloudflare (Pages, Workers, dan D1).

## ✨ Fitur Utama

- **Antarmuka Interaktif:** Desain bersih, modern, dan sangat responsif (mendukung mode *Dark* & *Light*).
- **Data Up-to-Date:** Terintegrasi dengan sistem pembaruan otomatis (Cron Job) yang menarik data libur terbaru.
- **Tampilan Weton & Hijriah:** Menampilkan tanggal Hijriah (kalender Islam) dan pasaran Jawa (Legi, Pahing, Pon, Wage, Kliwon).
- **API Tersedia:** Menyediakan JSON API yang dapat dikonsumsi oleh publik untuk mendapatkan daftar hari libur per tahun.
- **Otomatisasi:** Menggunakan GitHub Actions untuk sinkronisasi data dari sumber terpercaya ke database Cloudflare D1.

## 🛠️ Teknologi yang Digunakan

- **Frontend:** HTML5, Vanilla JavaScript, [Tailwind CSS](https://tailwindcss.com/), dan [Lucide Icons](https://lucide.dev/).
- **Backend (API):** Cloudflare Pages Functions (Serverless Workers).
- **Database:** Cloudflare D1 (Serverless SQLite).
- **Automasi:** GitHub Actions, Node.js scripts.

## 📡 Sumber Data & Sinkronisasi

Data kalender hari libur dan cuti bersama di Indonesia diperbarui secara otomatis. 
Selain itu, aplikasi ini juga menampilkan **Hari Besar Nasional & Internasional** yang bersumber dari API: [https://cal.weruka.dev/](https://cal.weruka.dev/).

Untuk melakukan sinkronisasi data hari besar tersebut secara manual, Anda bisa menarik datanya langsung dari terminal dengan menjalankan skrip berikut:
```bash
node scripts/sync-important-days.js
```
Skrip ini akan mengunduh data hari besar terbaru dan menyimpannya ke dalam folder `public/data/` dalam format JSON.

## 🚀 Cara Menjalankan Secara Lokal (Development)

Untuk mengembangkan dan menjalankan proyek ini di komputer Anda sendiri:

1. **Persyaratan Sistem:** Pastikan Anda telah menginstal [Node.js](https://nodejs.org/) versi 20+ dan npm.
2. **Kloning Repositori:**
   ```bash
   git clone https://github.com/bahrye/kalenderku.git
   cd kalenderku
   ```
3. **Instal Dependensi:**
   ```bash
   npm install
   ```
4. **Jalankan Server Lokal (Wrangler):**
   ```bash
   npm run dev
   ```
   Aplikasi akan berjalan di `http://localhost:8788`.

## 🌐 Endpoint API Publik

Kalenderku menyediakan API publik untuk mengambil daftar hari libur (format JSON):
**URL:** `/api/holidays?year={tahun}`

**Contoh Response:**
```json
[
  {
    "date": "2026-01-01",
    "name": "Tahun Baru Masehi",
    "is_leave_together": false
  },
  {
    "date": "2026-03-20",
    "name": "Cuti Bersama Hari Raya Idul Fitri",
    "is_leave_together": true
  }
]
```

## 📜 Lisensi

Proyek ini dilisensikan di bawah **MIT License**. Silakan lihat file [LICENSE](LICENSE) untuk informasi lebih lanjut.

---
*Dibuat oleh Syamsul Bahri | Hosted on Cloudflare Pages*
