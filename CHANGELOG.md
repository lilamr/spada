# Changelog

Semua perubahan penting pada proyek ini didokumentasikan di sini.
Format mengikuti [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.0.0] — 2026-03-26

### Fitur Baru
- **Save Project**: Simpan dan buka kembali state penuh project (`.spd` — format JSON)
  - Menyimpan semua layer, style, alias, tipe kolom, custom color, logo, nama aplikasi
  - Menu File → Proyek Baru / Buka Proyek / Simpan Proyek
- **Custom Palet Categorized**: Tombol "🎨 Atur Warna Custom" saat metode = Categorized
  - Dialog per nilai unik dengan color picker individual
  - Reset ke palet standar dengan satu klik
- **Tipe Data Kolom**: Kolom baru "Tipe" di panel Kolom & Alias
  - Auto-detect dari dtype pandas (Numerik / Kategorikal)
  - Bisa di-override manual per kolom
  - Field numerik digunakan untuk Field Nilai; kategorikal untuk Field Baris/X
- **Alias di Pivot, Chart, Visual Map**: Nama kolom yang tampil sekarang mengikuti
  setting alias di panel Kolom & Alias
- **Urutan Layer Konsisten**: Layer paling atas di list GUI = layer paling atas di peta
  (index 0 = background, index terakhir = foreground)
- **Mobile Friendly**: Dashboard HTML responsif untuk layar kecil
  - Tab navbar pindah ke bawah (fixed) di mobile
  - Sidebar collapsible
  - Chart dan Visual Map control stack vertikal
- **Identitas Aplikasi**: Nama, subjudul, dan logo dikelola dalam satu dialog terpadu
  (menu Pengaturan → Identitas Aplikasi)

### Perbaikan
- Fix crash saat buka dialog Identitas (`addWidget(form)` → `addLayout(form)`)
- Fix peta tidak tampil di live preview: JS syntax error `\n` dalam f-string template
- Fix logo tidak terupdate di live preview saat layer di-refresh
- Fix urutan layer di HTML terbalik terhadap GUI
- Hapus tombol "Logo" redundan dari toolbar (sudah ada di dialog Identitas)
- Fix segfault: `_setup_profile()` dipindah dari module-level ke `__init__`
- Fix judul window dobel karena newline hilang antar konstanta

---

## [0.9.0] — 2026-03-13

### Fitur Awal (MVP)
- **Peta Tematik**: Leaflet map dengan 5 basemap, sidebar layer, legenda, popup, label
- **Tab Atribut**: Tabel sortable, filter 11 operator, zoom ke fitur, sync dengan peta
- **Tab Pivot Table**: Agregasi count/sum/mean/min/max, heatmap per baris/kolom/global
- **Tab Chart**: Bar, Horizontal Bar, Pie, Doughnut, Line, Scatter + download PNG & SVG
- **Tab Visual Map**: 9 tipe — Heatmap, Cluster, Proportional, Choropleth, Hexbin,
  Dot Density, Cartogram, Time Series, Flow Map
- **Format input**: SHP, GeoJSON, KML, GPKG, GML, ZIP
- **Export HTML**: File standalone siap pakai (Leaflet + Chart.js)
- **Live Preview**: QWebEngineView dengan debounce dua kecepatan
- **Style Panel**: Single / Graduated / Categorized, label, opacity, stroke
- **Kolom & Alias**: Pilih kolom untuk popup & tabel, rename alias
- **Drag-drop layer**: Reorder layer di GUI, sync ke urutan peta
- **Identitas**: Ganti nama aplikasi, subjudul, dan logo di header dashboard
