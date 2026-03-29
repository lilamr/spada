"""
spada.core.exporter  v1.0.0
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
Build HTML dashboard standalone dari template terpisah.

Struktur template:
  templates/
  ├── dashboard.html      HTML skeleton dengan {placeholder}
  ├── css/
  │   ├── base.css        variabel, reset, typography, shared
  │   ├── layout.css      header, sidebar, tab nav, map controls
  │   ├── atribut.css     tabel atribut, filter panel
  │   ├── pivot.css       pivot table, ctrl sidebar
  │   ├── chart.css       chart ctrl, area, buttons
  │   └── vm.css          visual map, overlay, basemap selector
  └── js/
      ├── helpers.js      state vars, helper functions
      ├── map.js          peta tematik, layer render, export PNG
      ├── atribut.js      filter, tabel, sort, CSV
      ├── pivot.js        pivot render, sort, heatmap, CSV
      ├── chart.js        chart render, sort, PNG, SVG
      └── vm.js           9 tipe visual map, export PNG
"""

from __future__ import annotations

import json
from pathlib import Path

from .layer import LayerData

# ── Constants ─────────────────────────────────────────────────────────────────

_TMPL = Path(__file__).parent / "templates"

_CSS_ORDER = ["base", "layout", "atribut", "pivot", "chart", "vm"]
_JS_ORDER  = ["helpers", "map", "atribut", "pivot", "chart", "vm"]

PALETTES: dict[str, list[str]] = {
    "Blues":    ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"],
    "Reds":     ["#fee2e2", "#fca5a5", "#ef4444", "#b91c1c", "#7f1d1d"],
    "Greens":   ["#dcfce7", "#86efac", "#22c55e", "#15803d", "#14532d"],
    "Oranges":  ["#ffedd5", "#fdba74", "#f97316", "#c2410c", "#7c2d12"],
    "Purples":  ["#f3e8ff", "#d8b4fe", "#a855f7", "#7e22ce", "#4c1d95"],
    "Spectral": ["#d53e4f", "#fc8d59", "#fee08b", "#e6f598", "#99d594"],
    "Viridis":  ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"],
    "YlOrRd":   ["#ffffb2", "#fecc5c", "#fd8d3c", "#f03b20", "#bd0026"],
}


class HtmlExporter:
    """Baca template dari disk, inject data layer, hasilkan HTML standalone."""

    # PALETTES juga tersedia sebagai class attribute agar GUI bisa akses via HtmlExporter.PALETTES
    PALETTES = PALETTES

    # Class-level cache — template dibaca sekali per session
    _css_cache:  str | None = None
    _js_cache:   str | None = None
    _html_cache: str | None = None

    @classmethod
    def _load_templates(cls) -> None:
        """Muat semua template dari disk (cached)."""
        if cls._html_cache is not None:
            return
        cls._css_cache  = _bundle(_TMPL / "css", _CSS_ORDER, "css")
        cls._js_cache   = _bundle(_TMPL / "js",  _JS_ORDER,  "js")
        cls._html_cache = (_TMPL / "dashboard.html").read_text(encoding="utf-8")

    @classmethod
    def reload_templates(cls) -> None:
        """Paksa reload template (berguna saat development)."""
        cls._css_cache  = None
        cls._js_cache   = None
        cls._html_cache = None
        cls._load_templates()

    def build(
        self,
        layers: list[LayerData],
        title:    str = "SpaDa Dashboard",
        logo_b64: str | None = None,
        app_name: str = "SpaDa",
        app_sub:  str = "Spasial Dashboard",
    ) -> str:
        """Build HTML dashboard lengkap."""
        self._load_templates()

        layers_js = self._serialize_layers(layers)
        logo_tag  = _make_logo_tag(logo_b64)

        return self._html_cache.format(
            title         = _he(title),
            app_name      = _he(app_name),
            app_sub       = _he(app_sub),
            logo_tag      = logo_tag,
            css           = self._css_cache,
            js            = self._js_cache,
            layers_json   = layers_js,
            palettes_json = json.dumps(PALETTES, ensure_ascii=False),
        )

    def _serialize_layers(self, layers: list[LayerData]) -> str:
        """Serialisasi layers ke JSON string untuk injeksi ke JS."""
        layers_js = []
        for i, layer in enumerate(reversed(layers)):
            gj = layer.to_geojson_dict()
            sc = layer.get_style_config()
            sc["color_map"] = _compute_color_map(layer, sc)
            layers_js.append({
                "id":           f"layer_{i}",
                "name":         layer.name,
                "visible":      layer.visible,
                "geojson":      gj,
                "style":        sc,
                "all_fields":   layer.all_fields_info(),
                "popup_fields": sc["popup_fields"],
                "table_fields": sc["table_fields"],
            })
        return json.dumps(layers_js, ensure_ascii=False, default=str)

    def _compute_color_map(self, layer: LayerData, sc: dict) -> dict:
        return _compute_color_map(layer, sc)


# ── Private helpers ────────────────────────────────────────────────────────────

def _bundle(folder: Path, order: list[str], ext: str) -> str:
    """Gabungkan file-file template sesuai urutan."""
    parts = []
    for name in order:
        path = folder / f"{name}.{ext}"
        parts.append(f"/* ── {name}.{ext} ── */\n" + path.read_text(encoding="utf-8"))
    return "\n\n".join(parts)


def _he(s: str) -> str:
    """HTML escape untuk nilai yang diinjeksi ke atribut/konten HTML."""
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _make_logo_tag(logo_b64: str | None) -> str:
    if logo_b64:
        return (
            f'<img src="{logo_b64}" '
            'style="height:26px;width:auto;object-fit:contain;border-radius:4px">'
        )
    return (
        '<svg width="24" height="24" viewBox="0 0 24 24" fill="none">'
        '<rect width="24" height="24" rx="6" fill="#6366f1" fill-opacity=".2"/>'
        '<path d="M12 3L3 8l9 5 9-5-9-5zM3 16l9 5 9-5M3 12l9 5 9-5"'
        ' stroke="#818cf8" stroke-width="1.7" stroke-linecap="round"'
        ' stroke-linejoin="round"/>'
        '</svg>'
    )


def _compute_color_map(layer: LayerData, sc: dict) -> dict:
    if sc["classify_method"] not in ("graduated", "categorized"):
        return {}
    field = sc["classify_field"]
    if not field:
        return {}
    vals    = layer.gdf[field].dropna()
    palette = PALETTES.get(sc["classify_palette"], PALETTES["Blues"])

    if sc["classify_method"] == "categorized":
        cm = {}
        for j, cat in enumerate(vals.unique().tolist()):
            key    = str(cat)
            cm[key] = layer.custom_color_map.get(key, palette[j % len(palette)])
        return cm

    try:
        mn, mx = float(vals.min()), float(vals.max())
        n      = sc["classify_classes"]
        breaks = [mn + (mx - mn) * k / (n - 1) for k in range(n)] if n > 1 else [mn]
        return {"breaks": breaks, "palette": palette[:n]}
    except Exception:
        return {}
