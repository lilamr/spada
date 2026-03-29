"""
tests.test_exporter
~~~~~~~~~~~~~~~~~~~~
Unit test untuk HtmlExporter.
"""

import json

import pytest

from spada.core.exporter import HtmlExporter
from spada.core.layer import LayerData

# ── Fixtures ──────────────────────────────────

@pytest.fixture
def geojson_file(tmp_path):
    data = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [110.5, -7.5]},
                "properties": {"nama": "Surabaya", "jumlah": 100, "kategori": "A"},
            },
            {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [112.0, -8.0]},
                "properties": {"nama": "Malang", "jumlah": 200, "kategori": "B"},
            },
        ],
    }
    p = tmp_path / "cities.geojson"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


@pytest.fixture
def layer(geojson_file):
    return LayerData(str(geojson_file))


@pytest.fixture
def exporter():
    return HtmlExporter()


# ── Palettes ──────────────────────────────────

class TestPalettes:
    def test_all_palettes_have_5_colors(self):
        for name, colors in HtmlExporter.PALETTES.items():
            assert len(colors) >= 5, f"Palette {name} harus punya minimal 5 warna"

    def test_palette_colors_are_hex(self):
        for name, colors in HtmlExporter.PALETTES.items():
            for c in colors:
                assert c.startswith("#"), f"Warna {c} di palette {name} bukan hex"
                assert len(c) == 7


# ── Build ─────────────────────────────────────

class TestBuild:
    def test_returns_string(self, exporter, layer):
        html = exporter.build([layer], "Test")
        assert isinstance(html, str)

    def test_html_structure(self, exporter, layer):
        html = exporter.build([layer])
        assert "<!DOCTYPE html>" in html
        assert "<title>" in html
        assert "leaflet" in html.lower()
        assert "chart.js" in html.lower()

    def test_title_in_output(self, exporter, layer):
        html = exporter.build([layer], "Dashboard Jatim")
        assert "Dashboard Jatim" in html

    def test_layer_name_in_output(self, exporter, layer):
        html = exporter.build([layer])
        assert "cities" in html

    def test_layers_json_embedded(self, exporter, layer):
        html = exporter.build([layer])
        assert "LAYERS" in html

    def test_empty_layers(self, exporter):
        html = exporter.build([])
        assert "<!DOCTYPE html>" in html

    def test_multiple_layers(self, exporter, geojson_file):
        l1 = LayerData(str(geojson_file))
        l2 = LayerData(str(geojson_file))
        l2.name = "layer2"
        html = exporter.build([l1, l2])
        assert "layer_0" in html
        assert "layer_1" in html

    def test_popup_alias_in_output(self, exporter, layer):
        layer.field_configs[0].alias = "Nama Kota"
        html = exporter.build([layer])
        assert "Nama Kota" in html

    def test_hidden_field_not_in_table(self, exporter, layer):
        # Sembunyikan semua field dari tabel
        for fc in layer.field_configs:
            fc.in_table = False
        exporter.build([layer])
        sc = layer.get_style_config()
        assert sc["table_fields"] == []


# ── Color Map ─────────────────────────────────

class TestColorMap:
    def test_single_method_no_color_map(self, exporter, layer):
        layer.classify_method = "single"
        cm = exporter._compute_color_map(layer, layer.get_style_config())
        assert cm == {}

    def test_graduated_returns_breaks(self, exporter, layer):
        layer.classify_method = "graduated"
        layer.classify_field = "jumlah"
        layer.classify_classes = 3
        sc = layer.get_style_config()
        cm = exporter._compute_color_map(layer, sc)
        assert "breaks" in cm
        assert "palette" in cm
        assert len(cm["breaks"]) == 3

    def test_categorized_returns_dict(self, exporter, layer):
        layer.classify_method = "categorized"
        layer.classify_field = "kategori"
        sc = layer.get_style_config()
        cm = exporter._compute_color_map(layer, sc)
        assert "A" in cm
        assert "B" in cm
        assert all(v.startswith("#") for v in cm.values())

    def test_no_field_returns_empty(self, exporter, layer):
        layer.classify_method = "graduated"
        layer.classify_field = None
        cm = exporter._compute_color_map(layer, layer.get_style_config())
        assert cm == {}
