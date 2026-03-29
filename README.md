# SpaDa — Spasial Dashboard

<div align="center">

<img src="spada/resources/icon.png" width="120" alt="SpaDa Logo">

[![CI](https://github.com/lilamr/spada/actions/workflows/ci.yml/badge.svg)](https://github.com/lilamr/spada/actions)
[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![PyQt5](https://img.shields.io/badge/GUI-PyQt5-41cd52)](https://riverbankcomputing.com/software/pyqt/)
[![Version](https://img.shields.io/badge/Version-1.0.0-6366f1)](CHANGELOG.md)

**Aplikasi desktop untuk membuat dashboard visualisasi data spasial interaktif.**

Muat data spasial → atur style → simpan project → export HTML dashboard siap pakai.

</div>

---

## ✨ Fitur Utama

### 📂 Format Input
| Format | Ekstensi |
|--------|----------|
| Shapefile | `.shp` |
| GeoJSON | `.geojson`, `.json` |
| KML | `.kml` |
| GeoPackage | `.gpkg` |
| GML | `.gml` |
| ZIP (berisi shapefile) | `.zip` |

### 🗺 Dashboard HTML (5 Tab)
- **Peta Tematik** — Leaflet interaktif, 5 basemap, legenda, popup, label, download PNG (dengan legenda & skala)
- **Atribut** — Tabel sortable, filter 11 operator, zoom ke fitur, export CSV
- **Pivot Table** — Sidebar kontrol, sort per kolom, agregasi count/sum/mean/min/max, heatmap
- **Chart** — Bar, Horizontal Bar, Pie, Doughnut, Line, Scatter, sort nilai, download PNG & SVG
- **Visual Map** — 9 tipe: Heatmap, Cluster, Proportional Symbol, Choropleth, Hexbin, Dot Density, Cartogram, Time Series, Flow Map — download PNG dengan legenda

### 🎨 Style & Simbologi
- Single Symbol, Graduated (kuantitatif), Categorized (kualitatif)
- **Custom palette** per kategori dengan color picker individual
- Label per field, opacity, stroke, radius titik
- Alias kolom + tipe data (Numerik/Kategorikal) — auto-detect dari pandas

### 💾 Project
- Simpan/buka state penuh project (format `.spd`)
- Path layer disimpan **relatif** — project bisa dipindah & dibagikan lintas OS

### 🏷 Identitas Aplikasi
- Ganti nama aplikasi, subjudul, dan logo di header dashboard

### 📱 Mobile Friendly
- Tab navbar fixed di bawah layar mobile
- Semua panel responsif

### 🏗 Arsitektur Modular
```
spada/core/
├── exporter.py          # Python logic (~180 baris)
├── layer.py             # Model data layer
├── project.py           # Save/load .spd
└── templates/
    ├── dashboard.html   # HTML skeleton
    ├── css/             # 6 file CSS (base, layout, atribut, pivot, chart, vm)
    └── js/              # 6 file JS  (helpers, map, atribut, pivot, chart, vm)
```

---

## 🚀 Instalasi

### Prasyarat
- Python 3.10+

### Linux / macOS
```bash
git clone https://github.com/lilamr/spada.git
cd spada
python -m venv .venv
source .venv/bin/activate
pip install PyQt5 PyQtWebEngine
pip install geopandas fiona shapely pyproj pandas numpy
python main.py
```

### Windows
```cmd
git clone https://github.com/lilamr/spada.git
cd spada
python -m venv .venv
.venv\Scripts\activate
pip install PyQt5 PyQtWebEngine
pip install geopandas fiona shapely pyproj pandas numpy
python main.py
```

> **Windows tip**: Jika `geopandas` gagal, coba:
> ```cmd
> pip install pipwin && pipwin install gdal && pipwin install fiona && pip install geopandas
> ```

---

## 📁 Struktur Proyek

```
spada/
├── main.py
├── spada/
│   ├── resources/
│   │   └── icon.png
│   ├── core/
│   │   ├── exporter.py
│   │   ├── layer.py
│   │   ├── project.py
│   │   └── templates/
│   │       ├── dashboard.html
│   │       ├── css/  (base, layout, atribut, pivot, chart, vm)
│   │       └── js/   (helpers, map, atribut, pivot, chart, vm)
│   └── gui/
│       ├── main_window.py
│       ├── preview.py
│       ├── style_panel.py
│       ├── widgets.py
│       └── styles.py
├── tests/
└── requirements.txt
```

---

## 🧪 Testing

```bash
pip install pytest pytest-cov
pytest -v
pytest --cov=spada/core
```

---

## 📄 Format Project (.spd)

File project adalah JSON dengan path layer **relatif** terhadap lokasi `.spd`:

```json
{
  "version": "1.0.0",
  "app_name": "SpaDa",
  "app_sub": "Spasial Dashboard",
  "logo_b64": null,
  "layers": [
    {
      "path": "data/kawasan.shp",
      "name": "Kawasan Hutan",
      "classify_method": "categorized",
      "custom_color_map": { "HPT": "#22c55e", "HL": "#3b82f6" },
      "field_configs": [...]
    }
  ]
}
```

---

## 🤝 Kontribusi

1. Fork repository
2. Buat branch: `git checkout -b feat/nama-fitur`
3. Commit: `git commit -m "feat: deskripsi"`
4. Push & buat Pull Request

---

## 📜 Lisensi

[MIT](LICENSE) © 2026 lilamr
