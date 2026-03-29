"""
tests.test_layer
~~~~~~~~~~~~~~~~~
Unit test untuk FieldConfig dan LayerData.
"""

import json
from pathlib import Path

import pytest

from spada.core.layer import FieldConfig, LayerData

# ── Fixtures ──────────────────────────────────

@pytest.fixture
def sample_geojson(tmp_path) -> Path:
    """GeoJSON titik sederhana dengan beberapa atribut."""
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [110.0, -7.0]},
                "properties": {"nama": "Kota A", "populasi": 500000, "kode": "JT01"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [111.0, -7.5]},
                "properties": {"nama": "Kota B", "populasi": 350000, "kode": "JT02"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [112.0, -8.0]},
                "properties": {"nama": "Kota C", "populasi": None, "kode": "JT03"},
            },
        ],
    }
    p = tmp_path / "sample.geojson"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


@pytest.fixture
def layer(sample_geojson) -> LayerData:
    return LayerData(str(sample_geojson))


# ── FieldConfig ───────────────────────────────

class TestFieldConfig:
    def test_default_alias(self):
        fc = FieldConfig("populasi")
        assert fc.alias == "populasi"

    def test_set_alias(self):
        fc = FieldConfig("pop")
        fc.alias = "Populasi"
        assert fc.alias == "Populasi"

    def test_default_visibility(self):
        fc = FieldConfig("nama")
        assert fc.in_popup is True
        assert fc.in_table is True

    def test_to_dict(self):
        fc = FieldConfig("kode")
        fc.alias = "Kode Wilayah"
        d = fc.to_dict()
        assert d["name"] == "kode"
        assert d["alias"] == "Kode Wilayah"
        assert d["in_popup"] is True

    def test_repr(self):
        fc = FieldConfig("nama")
        assert "nama" in repr(fc)


# ── LayerData ─────────────────────────────────

class TestLayerData:
    def test_load(self, layer):
        assert layer.gdf is not None
        assert not layer.gdf.empty

    def test_feature_count(self, layer):
        assert layer.feature_count == 3

    def test_crs_reprojected(self, layer):
        assert layer.gdf.crs.to_epsg() == 4326

    def test_fields(self, layer):
        assert "nama" in layer.fields
        assert "populasi" in layer.fields
        assert "kode" in layer.fields
        assert "geometry" not in layer.fields

    def test_geom_type(self, layer):
        assert layer.geom_type == "Point"

    def test_field_configs_initialized(self, layer):
        assert len(layer.field_configs) == len(layer.fields)
        for fc in layer.field_configs:
            assert isinstance(fc, FieldConfig)

    def test_popup_fields_default_all(self, layer):
        assert len(layer.popup_fields()) == len(layer.fields)

    def test_table_fields_filtered(self, layer):
        layer.field_configs[0].in_table = False
        assert len(layer.table_fields()) == len(layer.fields) - 1

    def test_get_style_config_keys(self, layer):
        sc = layer.get_style_config()
        for key in ("fill_color", "opacity", "classify_method",
                    "popup_fields", "table_fields", "geom_type"):
            assert key in sc

    def test_popup_fields_alias_in_config(self, layer):
        layer.field_configs[0].alias = "Nama Kota"
        sc = layer.get_style_config()
        pf = {f["name"]: f["alias"] for f in sc["popup_fields"]}
        assert pf.get("nama") == "Nama Kota"

    def test_to_geojson_dict(self, layer):
        gj = layer.to_geojson_dict()
        assert gj["type"] == "FeatureCollection"
        assert len(gj["features"]) == 3

    def test_repr(self, layer):
        r = repr(layer)
        assert "sample" in r
        assert "3" in r

    def test_color_auto_assigned(self, sample_geojson, tmp_path):
        # Setiap layer mendapatkan warna berbeda secara otomatis
        l1 = LayerData(str(sample_geojson))
        l2 = LayerData(str(sample_geojson))
        # Warna bisa sama jika indeks berputar, tapi harus valid hex
        assert l1.fill_color.startswith("#")
        assert l2.fill_color.startswith("#")
