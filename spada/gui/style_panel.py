"""
spada.gui.style_panel
~~~~~~~~~~~~~~~~~~~~~~
Panel konfigurasi style, label, dan kolom atribut untuk layer aktif.
"""

from __future__ import annotations

from PyQt5.QtWidgets import (
    QWidget, QVBoxLayout, QFormLayout, QHBoxLayout,
    QGroupBox, QComboBox, QSlider, QSpinBox, QDoubleSpinBox,
    QCheckBox, QPushButton, QLabel, QDialog, QDialogButtonBox,
    QScrollArea, QFrame,
)
from PyQt5.QtCore import Qt, pyqtSignal, QSignalBlocker

from ..core.layer import LayerData
from ..core.exporter import HtmlExporter
from .widgets import ColorButton, FieldConfigTable
from .styles import GROUP_BOX, APP_DARK


class StylePanel(QWidget):
    """Panel konfigurasi tampilan & atribut untuk layer yang aktif."""

    styleChanged = pyqtSignal()

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self.layer: LayerData | None = None
        self._build_ui()

    # ── UI Builder ────────────────────────────

    def _build_ui(self) -> None:
        lay = QVBoxLayout(self)
        lay.setContentsMargins(8, 8, 8, 8)
        lay.setSpacing(8)
        lay.addWidget(self._build_symbology())
        lay.addWidget(self._build_classify())
        lay.addWidget(self._build_label())
        lay.addWidget(self._build_field_config())
        lay.addStretch()

    def _build_symbology(self) -> QGroupBox:
        grp = QGroupBox("Symbology")
        grp.setStyleSheet(GROUP_BOX)
        f = QFormLayout(grp)
        f.setSpacing(6)

        self.method_combo = QComboBox()
        self.method_combo.addItems(["Single Symbol", "Graduated", "Categorized"])
        self.method_combo.currentIndexChanged.connect(self._on_method_change)
        f.addRow("Metode:", self.method_combo)

        self.fill_btn = ColorButton()
        self.fill_btn.colorChanged.connect(self._update)
        f.addRow("Warna Isi:", self.fill_btn)

        self.stroke_btn = ColorButton("#ffffff")
        self.stroke_btn.colorChanged.connect(self._update)
        f.addRow("Warna Garis:", self.stroke_btn)

        self.stroke_spin = QDoubleSpinBox()
        self.stroke_spin.setRange(0, 10)
        self.stroke_spin.setSingleStep(0.5)
        self.stroke_spin.setValue(1.5)
        self.stroke_spin.valueChanged.connect(self._update)
        f.addRow("Tebal Garis:", self.stroke_spin)

        self.radius_spin = QSpinBox()
        self.radius_spin.setRange(2, 30)
        self.radius_spin.setValue(6)
        self.radius_spin.valueChanged.connect(self._update)
        f.addRow("Radius Titik:", self.radius_spin)

        self.opacity_slider = QSlider(Qt.Horizontal)
        self.opacity_slider.setRange(0, 100)
        self.opacity_slider.setValue(80)
        self.opacity_slider.valueChanged.connect(self._update)
        f.addRow("Opacity:", self.opacity_slider)

        return grp

    def _build_classify(self) -> QGroupBox:
        self.classify_grp = QGroupBox("Klasifikasi")
        self.classify_grp.setStyleSheet(GROUP_BOX)
        self.classify_grp.setVisible(False)
        f = QFormLayout(self.classify_grp)
        f.setSpacing(6)

        self.class_field = QComboBox()
        self.class_field.currentIndexChanged.connect(self._update)
        f.addRow("Field:", self.class_field)

        self.palette_combo = QComboBox()
        self.palette_combo.addItems(list(HtmlExporter.PALETTES.keys()))
        self.palette_combo.currentIndexChanged.connect(self._on_palette_change)
        f.addRow("Palet:", self.palette_combo)

        # Jumlah kelas — hanya untuk Graduated
        self._class_n_lbl = QLabel("Kelas:")
        self.class_n = QSpinBox()
        self.class_n.setRange(2, 9)
        self.class_n.setValue(5)
        self.class_n.valueChanged.connect(self._update)
        f.addRow(self._class_n_lbl, self.class_n)

        # Tombol custom warna — hanya untuk Categorized
        self._custom_pal_lbl = QLabel("")
        self.custom_pal_btn = QPushButton("🎨 Atur Warna Custom…")
        self.custom_pal_btn.setStyleSheet(
            "QPushButton{background:#22263a;border:1px solid #2d3250;"
            "color:#818cf8;padding:3px 8px;border-radius:4px;font-size:10px;}"
            "QPushButton:hover{border-color:#6366f1;color:#fff;}"
        )
        self.custom_pal_btn.clicked.connect(self._open_custom_palette_dialog)
        f.addRow(self._custom_pal_lbl, self.custom_pal_btn)
        self._custom_pal_lbl.setVisible(False)
        self.custom_pal_btn.setVisible(False)

        return self.classify_grp

    def _build_label(self) -> QGroupBox:
        grp = QGroupBox("Label")
        grp.setStyleSheet(GROUP_BOX)
        f = QFormLayout(grp)
        f.setSpacing(6)

        self.label_check = QCheckBox("Aktifkan Label")
        self.label_check.stateChanged.connect(self._update)
        f.addRow(self.label_check)

        self.label_field_combo = QComboBox()
        self.label_field_combo.currentIndexChanged.connect(self._update)
        f.addRow("Field Label:", self.label_field_combo)

        self.label_size = QSpinBox()
        self.label_size.setRange(6, 24)
        self.label_size.setValue(11)
        self.label_size.valueChanged.connect(self._update)
        f.addRow("Ukuran Font:", self.label_size)

        self.label_color_btn = ColorButton("#222222")
        self.label_color_btn.colorChanged.connect(self._update)
        f.addRow("Warna Teks:", self.label_color_btn)

        self.label_halo = QCheckBox("Halo (outline)")
        self.label_halo.setChecked(True)
        self.label_halo.stateChanged.connect(self._update)
        f.addRow(self.label_halo)

        return grp

    def _build_field_config(self) -> QGroupBox:
        grp = QGroupBox("Kolom & Alias")
        grp.setStyleSheet(GROUP_BOX)
        lay = QVBoxLayout(grp)
        lay.setContentsMargins(6, 8, 6, 6)
        lay.setSpacing(6)

        hint = QLabel(
            "Centang kolom yang ditampilkan di Popup dan Tabel.\n"
            "Alias = nama tampilan di dashboard. Tipe = numerik/kategorikal."
        )
        hint.setWordWrap(True)
        hint.setStyleSheet("color:#64748b;font-size:10px;line-height:1.4;")
        lay.addWidget(hint)

        self.field_table = FieldConfigTable()
        self.field_table.changed.connect(self._update)
        self.field_table.setFixedHeight(180)
        lay.addWidget(self.field_table)

        row = QHBoxLayout()
        row.setSpacing(4)
        for label, fn, tip in [
            ("✓P", lambda: self.field_table.set_all(2, True),  "Semua tampil di Popup"),
            ("✗P", lambda: self.field_table.set_all(2, False), "Hapus semua dari Popup"),
            ("✓T", lambda: self.field_table.set_all(3, True),  "Semua tampil di Tabel"),
            ("✗T", lambda: self.field_table.set_all(3, False), "Hapus semua dari Tabel"),
        ]:
            b = QPushButton(label)
            b.setFixedHeight(22)
            b.setToolTip(tip)
            b.setStyleSheet("font-size:10px;padding:1px 6px;")
            b.clicked.connect(fn)
            row.addWidget(b)
        lay.addLayout(row)
        return grp

    # ── Public ────────────────────────────────

    def load_layer(self, layer: LayerData) -> None:
        self.layer = layer

        _blockable = [
            self.method_combo, self.fill_btn, self.stroke_btn,
            self.stroke_spin, self.radius_spin, self.opacity_slider,
            self.class_field, self.palette_combo, self.class_n,
            self.label_check, self.label_field_combo,
            self.label_size, self.label_color_btn, self.label_halo,
        ]
        blockers = [QSignalBlocker(w) for w in _blockable]

        try:
            self.fill_btn.set_color(layer.fill_color)
            self.stroke_btn.set_color(layer.stroke_color)
            self.stroke_spin.setValue(layer.stroke_width)
            self.radius_spin.setValue(layer.point_radius)
            self.opacity_slider.setValue(int(layer.opacity * 100))

            method_idx = {"single": 0, "graduated": 1, "categorized": 2}.get(
                layer.classify_method, 0
            )
            self.method_combo.setCurrentIndex(method_idx)
            self.classify_grp.setVisible(method_idx > 0)
            self.fill_btn.setEnabled(method_idx == 0)

            is_grad = (method_idx == 1)
            is_cat  = (method_idx == 2)
            self._class_n_lbl.setVisible(is_grad)
            self.class_n.setVisible(is_grad)
            self._custom_pal_lbl.setVisible(is_cat)
            self.custom_pal_btn.setVisible(is_cat)

            self.class_field.clear()
            self.label_field_combo.clear()
            for fld in layer.fields:
                self.class_field.addItem(fld)
                self.label_field_combo.addItem(fld)

            if layer.classify_field and layer.classify_field in layer.fields:
                self.class_field.setCurrentText(layer.classify_field)
            if layer.classify_palette in HtmlExporter.PALETTES:
                self.palette_combo.setCurrentText(layer.classify_palette)
            self.class_n.setValue(layer.classify_classes)

            self.label_check.setChecked(layer.label_enabled)
            self.label_size.setValue(layer.label_size)
            self.label_color_btn.set_color(layer.label_color)
            self.label_halo.setChecked(layer.label_halo)

        finally:
            del blockers

        self.field_table.load(layer.field_configs)
        self._update_custom_btn_label()

    # ── Slots ─────────────────────────────────

    def _on_method_change(self) -> None:
        m = self.method_combo.currentIndex()
        self.classify_grp.setVisible(m > 0)
        self.fill_btn.setEnabled(m == 0)
        is_grad = (m == 1)
        is_cat  = (m == 2)
        self._class_n_lbl.setVisible(is_grad)
        self.class_n.setVisible(is_grad)
        self._custom_pal_lbl.setVisible(is_cat)
        self.custom_pal_btn.setVisible(is_cat)
        self._update()

    def _on_palette_change(self) -> None:
        """Ganti palet → reset custom color map."""
        if self.layer and self.layer.classify_method == "categorized":
            self.layer.custom_color_map = {}
            self._update_custom_btn_label()
        self._update()

    def _update_custom_btn_label(self) -> None:
        if not self.layer:
            return
        n = len(self.layer.custom_color_map)
        if n:
            self.custom_pal_btn.setText(f"✎ Edit Warna Custom ({n} aktif)")
        else:
            self.custom_pal_btn.setText("🎨 Atur Warna Custom…")

    def _open_custom_palette_dialog(self) -> None:
        if not self.layer:
            return
        field = self.class_field.currentText()
        if not field:
            return

        try:
            unique_vals = [str(v) for v in self.layer.gdf[field].dropna().unique().tolist()]
        except Exception:
            return
        if not unique_vals:
            return

        palette = HtmlExporter.PALETTES.get(
            self.layer.classify_palette, list(HtmlExporter.PALETTES.values())[0]
        )
        current = dict(self.layer.custom_color_map)

        dlg = QDialog(self)
        dlg.setWindowTitle(f"Warna Custom — {field}")
        dlg.setMinimumWidth(320)
        dlg.setStyleSheet(APP_DARK)
        vlay = QVBoxLayout(dlg)
        vlay.setSpacing(8)

        lbl = QLabel(f"Atur warna per nilai unik kolom '{field}':")
        lbl.setStyleSheet("color:#94a3b8;font-size:10px;")
        vlay.addWidget(lbl)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        scroll.setMaximumHeight(320)
        inner = QWidget()
        inner_lay = QVBoxLayout(inner)
        inner_lay.setSpacing(4)
        inner_lay.setContentsMargins(4, 4, 4, 4)

        color_btns: dict[str, ColorButton] = {}
        for i, val in enumerate(unique_vals[:50]):
            init_color = current.get(val, palette[i % len(palette)])
            btn = ColorButton(init_color)
            color_btns[val] = btn

            row_w = QWidget()
            row_h = QHBoxLayout(row_w)
            row_h.setContentsMargins(0, 0, 0, 0)
            row_h.setSpacing(8)
            lbl_val = QLabel(val[:40] + ("…" if len(val) > 40 else ""))
            lbl_val.setStyleSheet("color:#e2e8f0;font-size:10px;")
            lbl_val.setMinimumWidth(160)
            row_h.addWidget(btn)
            row_h.addWidget(lbl_val)
            row_h.addStretch()
            inner_lay.addWidget(row_w)

        scroll.setWidget(inner)
        vlay.addWidget(scroll)

        reset_btn = QPushButton("↺ Reset ke Palet")
        reset_btn.setStyleSheet(
            "QPushButton{background:#22263a;border:1px solid #2d3250;"
            "color:#94a3b8;padding:4px 10px;border-radius:4px;font-size:10px;}"
            "QPushButton:hover{border-color:#6366f1;color:#fff;}"
        )
        def do_reset():
            for i2, val2 in enumerate(unique_vals[:50]):
                color_btns[val2].set_color(palette[i2 % len(palette)])
        reset_btn.clicked.connect(do_reset)
        vlay.addWidget(reset_btn)

        btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        btns.accepted.connect(dlg.accept)
        btns.rejected.connect(dlg.reject)
        vlay.addWidget(btns)

        if dlg.exec_() == QDialog.Accepted:
            self.layer.custom_color_map = {v: color_btns[v].color() for v in color_btns}
            self._update_custom_btn_label()
            self.styleChanged.emit()

    def _update(self) -> None:
        """Sinkronisasi nilai kontrol → layer, lalu emit styleChanged."""
        if not self.layer:
            return

        self.layer.fill_color   = self.fill_btn.color()
        self.layer.stroke_color = self.stroke_btn.color()
        self.layer.stroke_width = self.stroke_spin.value()
        self.layer.point_radius = self.radius_spin.value()
        self.layer.opacity      = self.opacity_slider.value() / 100.0

        self.layer.classify_method  = ["single", "graduated", "categorized"][
            self.method_combo.currentIndex()
        ]
        self.layer.classify_field   = self.class_field.currentText() or None
        self.layer.classify_palette = self.palette_combo.currentText()
        self.layer.classify_classes = self.class_n.value()

        self.layer.label_enabled = self.label_check.isChecked()
        self.layer.label_field   = (
            self.label_field_combo.currentText() if self.layer.label_enabled else None
        )
        self.layer.label_size    = self.label_size.value()
        self.layer.label_color   = self.label_color_btn.color()
        self.layer.label_halo    = self.label_halo.isChecked()

        self.styleChanged.emit()
