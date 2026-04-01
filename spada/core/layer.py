"""
spada.core.layer
~~~~~~~~~~~~~~~~
Data model untuk layer spasial: FieldConfig dan LayerData.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import geopandas as gpd
import pandas as pd


class FieldConfig:
    """Konfigurasi tampilan per kolom atribut."""

    def __init__(self, name: str) -> None:
        self.name: str = name
        self.alias: str = name
        self.in_popup: bool = True
        self.in_table: bool = True
        # "auto"|"numeric"|"categorical" — bisa di-override user
        self.field_type: str = "auto"

    def to_dict(self) -> dict:
        return {
            "name":       self.name,
            "alias":      self.alias,
            "in_popup":   self.in_popup,
            "in_table":   self.in_table,
            "field_type": self.field_type,
        }

    def __repr__(self) -> str:
        return f"FieldConfig({self.name!r}, alias={self.alias!r}, type={self.field_type!r})"


class LayerData:
    """
    Representasi satu layer spasial beserta konfigurasi style dan
    konfigurasi tampilan kolom atributnya.
    """

    SUPPORTED_COLORS: list[str] = [
        "#e74c3c", "#e67e22", "#f1c40f", "#2ecc71", "#1abc9c",
        "#3498db", "#9b59b6", "#34495e", "#e91e63", "#00bcd4",
        "#8bc34a", "#ff5722", "#607d8b", "#795548", "#673ab7",
    ]
    _color_idx: int = 0
    _WEB_SIMPLIFY_FEATURE_THRESHOLD: int = int(
        os.getenv("SPADA_WEB_SIMPLIFY_FEATURE_THRESHOLD", "3000")
    )
    _WEB_SIMPLIFY_FACTOR: float = float(
        os.getenv("SPADA_WEB_SIMPLIFY_FACTOR", "0.0007")
    )

    def __init__(self, path: str) -> None:
        self.path: str = path
        self.name: str = Path(path).stem
        self.visible: bool = True
        self.opacity: float = 0.8
        self.gdf: gpd.GeoDataFrame | None = None
        self.geom_type: str | None = None

        # Style
        LayerData._color_idx = (LayerData._color_idx + 3) % len(self.SUPPORTED_COLORS)
        self.fill_color: str = self.SUPPORTED_COLORS[LayerData._color_idx]
        self.stroke_color: str = "#ffffff"
        self.stroke_width: float = 1.5
        self.point_radius: int = 6

        # Label
        self.label_enabled: bool = False
        self.label_field: str | None = None
        self.label_size: int = 11
        self.label_color: str = "#222222"
        self.label_halo: bool = True

        # Klasifikasi
        self.classify_method: str = "single"   # single | graduated | categorized
        self.classify_field: str | None = None
        self.classify_palette: str = "Blues"
        self.classify_classes: int = 5
        self.color_map: dict = {}
        # Warna custom per kategori — kalau diisi, menggantikan palette untuk categorized
        self.custom_color_map: dict[str, str] = {}

        # Field configs (diinisiasi setelah load)
        self.field_configs: list[FieldConfig] = []
        self._geojson_cache: dict | None = None

        self._load()

    # ── Private ───────────────────────────────

    def _load(self) -> None:
        """Baca file spasial, reprojecsi ke WGS-84, init field_configs."""
        ext = Path(self.path).suffix.lower()
        self._geojson_cache = None

        if ext == ".kml":
            import fiona
            with fiona.Env():
                gdfs = []
                for lyr in fiona.listlayers(self.path):
                    try:
                        g = gpd.read_file(self.path, layer=lyr)
                        if not g.empty:
                            gdfs.append(g)
                    except Exception:
                        pass
            self.gdf = (
                pd.concat(gdfs, ignore_index=True) if gdfs else gpd.GeoDataFrame()
            )
        else:
            self.gdf = self._read_spatial_file(self.path)

        if self.gdf.crs and self.gdf.crs.to_epsg() != 4326:
            self.gdf = self.gdf.to_crs(epsg=4326)

        self.gdf = self.gdf[self.gdf.geometry.notnull()].reset_index(drop=True)

        if not self.gdf.empty:
            self.geom_type = self.gdf.geometry.geom_type.iloc[0]

        self.field_configs = [FieldConfig(f) for f in self.fields]

        # Auto-detect tipe data dari dtype pandas
        for fc in self.field_configs:
            col = self.gdf[fc.name]
            fc.field_type = "numeric" if pd.api.types.is_numeric_dtype(col) else "categorical"

    # ── Properties ────────────────────────────

    @property
    def fields(self) -> list[str]:
        """Semua kolom atribut (tanpa kolom geometry)."""
        return [c for c in self.gdf.columns if c != "geometry"]

    @property
    def feature_count(self) -> int:
        return len(self.gdf) if self.gdf is not None else 0

    # ── Helpers ───────────────────────────────

    def popup_fields(self) -> list[FieldConfig]:
        return [fc for fc in self.field_configs if fc.in_popup]

    def table_fields(self) -> list[FieldConfig]:
        return [fc for fc in self.field_configs if fc.in_table]

    def all_fields_info(self) -> list[dict]:
        """Kolom aktif (in_table=True) dengan alias dan tipe — untuk pivot/chart/vm."""
        return [
            {"name": fc.name, "alias": fc.alias, "type": fc.field_type}
            for fc in self.field_configs
            if fc.in_table
        ]

    def to_geojson_dict(self) -> dict:
        if self._geojson_cache is not None:
            return self._geojson_cache
        web_gdf = self._optimized_web_gdf()
        self._geojson_cache = json.loads(web_gdf.to_json(drop_id=True))
        return self._geojson_cache

    def _read_spatial_file(self, path: str) -> gpd.GeoDataFrame:
        """
        Reader dengan fallback:
        - utamakan pyogrio + Arrow (lebih cepat untuk SHP/GPKG besar)
        - fallback ke backend default geopandas bila tidak tersedia
        """
        try:
            return gpd.read_file(path, engine="pyogrio", use_arrow=True)
        except Exception:
            return gpd.read_file(path)

    def _optimized_web_gdf(self) -> gpd.GeoDataFrame:
        """
        Untuk dataset besar, sederhanakan geometri sebelum serialisasi GeoJSON
        agar render dashboard/preview tetap responsif.
        """
        if self.gdf.empty or self.feature_count < self._WEB_SIMPLIFY_FEATURE_THRESHOLD:
            return self.gdf
        if self.geom_type not in {"Polygon", "MultiPolygon"}:
            return self.gdf
        minx, miny, maxx, maxy = self.gdf.total_bounds
        max_span = max(abs(maxx - minx), abs(maxy - miny))
        tolerance = max_span * self._WEB_SIMPLIFY_FACTOR
        if tolerance <= 0:
            return self.gdf
        gdf_web = self.gdf.copy()
        gdf_web.geometry = gdf_web.geometry.simplify(
            tolerance=tolerance,
            preserve_topology=True,
        )
        gdf_web = gdf_web[gdf_web.geometry.notnull()]
        gdf_web = gdf_web[~gdf_web.geometry.is_empty]
        return gdf_web.reset_index(drop=True)

    def get_style_config(self) -> dict:
        return {
            "fill_color":       self.fill_color,
            "stroke_color":     self.stroke_color,
            "stroke_width":     self.stroke_width,
            "point_radius":     self.point_radius,
            "opacity":          self.opacity,
            "label_field":      self.label_field if self.label_enabled else None,
            "label_size":       self.label_size,
            "label_color":      self.label_color,
            "label_halo":       self.label_halo,
            "classify_method":  self.classify_method,
            "classify_field":   self.classify_field,
            "classify_palette": self.classify_palette,
            "classify_classes": self.classify_classes,
            "color_map":        self.color_map,
            "geom_type":        self.geom_type,
            "popup_fields": [
                {"name": fc.name, "alias": fc.alias} for fc in self.popup_fields()
            ],
            "table_fields": [
                {"name": fc.name, "alias": fc.alias} for fc in self.table_fields()
            ],
        }

    def __repr__(self) -> str:
        return (
            f"LayerData({self.name!r}, "
            f"{self.feature_count} features, "
            f"{self.geom_type})"
        )
