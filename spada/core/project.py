"""
spada.core.project
~~~~~~~~~~~~~~~~~~~
Simpan dan muat project SpaDa (.spd — format JSON).

Path layer disimpan RELATIF terhadap lokasi file .spd sehingga
folder project bisa dipindah/dibagikan lintas OS.
"""

from __future__ import annotations

import json
import traceback
from pathlib import Path

from .layer import LayerData

_VERSION = "1.0.0"


def save(
    path: str,
    layers: list[LayerData],
    app_name: str = "SpaDa",
    app_sub: str = "Spasial Dashboard",
    logo_b64: str | None = None,
) -> None:
    """Simpan state project ke file .spd (JSON) dengan path relatif."""
    spd_dir = Path(path).parent.resolve()
    data = {
        "version":  _VERSION,
        "app_name": app_name,
        "app_sub":  app_sub,
        "logo_b64": logo_b64,
        "layers":   [_layer_to_dict(lyr, spd_dir) for lyr in layers],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _layer_to_dict(lyr: LayerData, spd_dir: Path) -> dict:
    # Simpan path relatif (pakai forward slash agar cross-OS)
    try:
        rel = Path(lyr.path).resolve().relative_to(spd_dir)
        saved_path = rel.as_posix()          # selalu pakai /
    except ValueError:
        # File di drive/partisi berbeda — fallback ke absolute
        saved_path = Path(lyr.path).resolve().as_posix()

    return {
        "path":             saved_path,
        "name":             lyr.name,
        "visible":          lyr.visible,
        "opacity":          lyr.opacity,
        "fill_color":       lyr.fill_color,
        "stroke_color":     lyr.stroke_color,
        "stroke_width":     lyr.stroke_width,
        "point_radius":     lyr.point_radius,
        "label_enabled":    lyr.label_enabled,
        "label_field":      lyr.label_field,
        "label_size":       lyr.label_size,
        "label_color":      lyr.label_color,
        "label_halo":       lyr.label_halo,
        "classify_method":  lyr.classify_method,
        "classify_field":   lyr.classify_field,
        "classify_palette": lyr.classify_palette,
        "classify_classes": lyr.classify_classes,
        "custom_color_map": lyr.custom_color_map,
        "field_configs":    [fc.to_dict() for fc in lyr.field_configs],
    }


def load(path: str) -> tuple[list[LayerData], dict, list[str]]:
    """
    Muat project dari file .spd.
    Path layer diresolve relatif terhadap lokasi file .spd.
    Returns: (layers, settings, errors)
    """
    spd_dir = Path(path).parent.resolve()

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    layers: list[LayerData] = []
    errors: list[str] = []

    for ld in data.get("layers", []):
        raw_path = ld.get("path", "")
        try:
            # Resolve: coba relatif dulu, lalu absolut
            candidate = (spd_dir / raw_path).resolve()
            if candidate.exists():
                layer_path = str(candidate)
            else:
                # Mungkin sudah absolut atau pakai separator OS lain
                abs_candidate = Path(raw_path.replace("/", "\\") if "\\" not in raw_path
                                     else raw_path).resolve()
                if abs_candidate.exists():
                    layer_path = str(abs_candidate)
                else:
                    errors.append(f"File tidak ditemukan: {raw_path}")
                    continue

            layer = LayerData(layer_path)
            layer.name          = ld.get("name", layer.name)
            layer.visible       = ld.get("visible", True)
            layer.opacity       = ld.get("opacity", 0.8)
            layer.fill_color    = ld.get("fill_color", layer.fill_color)
            layer.stroke_color  = ld.get("stroke_color", "#ffffff")
            layer.stroke_width  = ld.get("stroke_width", 1.5)
            layer.point_radius  = ld.get("point_radius", 6)
            layer.label_enabled = ld.get("label_enabled", False)
            layer.label_field   = ld.get("label_field")
            layer.label_size    = ld.get("label_size", 11)
            layer.label_color   = ld.get("label_color", "#222222")
            layer.label_halo    = ld.get("label_halo", True)
            layer.classify_method  = ld.get("classify_method", "single")
            layer.classify_field   = ld.get("classify_field")
            layer.classify_palette = ld.get("classify_palette", "Blues")
            layer.classify_classes = ld.get("classify_classes", 5)
            layer.custom_color_map = ld.get("custom_color_map", {})

            saved_fcs = {fc["name"]: fc for fc in ld.get("field_configs", [])}
            for fc in layer.field_configs:
                if fc.name in saved_fcs:
                    s = saved_fcs[fc.name]
                    fc.alias      = s.get("alias", fc.name)
                    fc.in_popup   = s.get("in_popup", True)
                    fc.in_table   = s.get("in_table", True)
                    fc.field_type = s.get("field_type", fc.field_type)

            layers.append(layer)

        except Exception:
            errors.append(f"Gagal memuat '{raw_path}':\n{traceback.format_exc(limit=3)}")

    settings = {
        "app_name": data.get("app_name", "SpaDa"),
        "app_sub":  data.get("app_sub",  "Spasial Dashboard"),
        "logo_b64": data.get("logo_b64"),
    }
    return layers, settings, errors
