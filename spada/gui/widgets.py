"""
spada.gui.widgets
~~~~~~~~~~~~~~~~~~
Widget Qt reusable: ColorButton dan FieldConfigTable.
"""

from __future__ import annotations

from PyQt5.QtWidgets import (
    QPushButton, QColorDialog, QTableWidget, QTableWidgetItem,
    QHeaderView, QAbstractItemView, QCheckBox, QComboBox,
    QWidget, QHBoxLayout,
)
from PyQt5.QtCore import Qt, pyqtSignal
from PyQt5.QtGui import QColor, QCursor

from ..core.layer import FieldConfig
from .styles import FIELD_TABLE


class ColorButton(QPushButton):
    """Tombol warna kecil — klik untuk membuka color picker."""

    colorChanged = pyqtSignal(str)

    def __init__(self, color: str = "#3498db", parent=None) -> None:
        super().__init__(parent)
        self.setFixedSize(28, 28)
        self.setCursor(QCursor(Qt.PointingHandCursor))
        self.set_color(color)
        self.clicked.connect(self._pick)

    def set_color(self, hex_color: str) -> None:
        self._color = hex_color
        self.setStyleSheet(
            f"QPushButton{{background:{hex_color};border:2px solid #2d3250;border-radius:6px;}}"
            "QPushButton:hover{border-color:#6366f1;}"
        )

    def color(self) -> str:
        return self._color

    def _pick(self) -> None:
        c = QColorDialog.getColor(QColor(self._color), self, "Pilih Warna")
        if c.isValid():
            self.set_color(c.name())
            self.colorChanged.emit(c.name())


class FieldConfigTable(QTableWidget):
    """
    Tabel editable konfigurasi kolom atribut layer.

    Kolom:
      0 — Nama kolom asli  (read-only)
      1 — Alias / Tampilan (editable)
      2 — Tampil di Popup  (checkbox)
      3 — Tampil di Tabel  (checkbox)
      4 — Tipe Data        (combobox: Numerik / Kategorikal)
    """

    changed = pyqtSignal()

    _TYPE_VALUES = ["numeric", "categorical"]
    _TYPE_LABELS = ["Numerik", "Kategorikal"]

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        self._loading: bool = False
        self._fcs: list[FieldConfig] = []

        self.setColumnCount(5)
        self.setHorizontalHeaderLabels(
            ["Kolom Asli", "Alias", "Popup", "Tabel", "Tipe"]
        )
        h = self.horizontalHeader()
        h.setSectionResizeMode(0, QHeaderView.ResizeToContents)
        h.setSectionResizeMode(1, QHeaderView.Stretch)
        h.setSectionResizeMode(2, QHeaderView.ResizeToContents)
        h.setSectionResizeMode(3, QHeaderView.ResizeToContents)
        h.setSectionResizeMode(4, QHeaderView.ResizeToContents)

        self.verticalHeader().setVisible(False)
        self.setSelectionMode(QAbstractItemView.NoSelection)
        self.setStyleSheet(FIELD_TABLE)
        self.itemChanged.connect(self._on_item_changed)

    # ── Public ────────────────────────────────

    def load(self, field_configs: list[FieldConfig]) -> None:
        self._loading = True
        self._fcs = field_configs
        self.setRowCount(len(field_configs))

        for i, fc in enumerate(field_configs):
            ni = QTableWidgetItem(fc.name)
            ni.setFlags(Qt.ItemIsEnabled)
            ni.setForeground(QColor("#64748b"))
            self.setItem(i, 0, ni)

            self.setItem(i, 1, QTableWidgetItem(fc.alias))
            self.setCellWidget(i, 2, self._checkbox_widget(fc.in_popup))
            self.setCellWidget(i, 3, self._checkbox_widget(fc.in_table))
            self.setCellWidget(i, 4, self._type_widget(fc.field_type))

        self.resizeRowsToContents()
        self._loading = False

    def set_all(self, col_idx: int, state: bool) -> None:
        self._loading = True
        for i in range(self.rowCount()):
            cb = self._get_cb(i, col_idx)
            if cb:
                cb.setChecked(state)
        self._loading = False
        self._sync_and_emit()

    # ── Private ───────────────────────────────

    def _checkbox_widget(self, checked: bool) -> QWidget:
        cb = QCheckBox()
        cb.setChecked(checked)
        cb.stateChanged.connect(self._sync_and_emit)
        w = QWidget()
        lay = QHBoxLayout(w)
        lay.setContentsMargins(8, 0, 0, 0)
        lay.addWidget(cb)
        return w

    def _type_widget(self, field_type: str) -> QComboBox:
        combo = QComboBox()
        combo.addItems(self._TYPE_LABELS)
        # "auto" → default ke numeric jika ada, else categorical
        val = field_type if field_type in self._TYPE_VALUES else "numeric"
        combo.setCurrentIndex(self._TYPE_VALUES.index(val))
        combo.setStyleSheet(
            "QComboBox{background:#22263a;border:1px solid #2d3250;color:#e2e8f0;"
            "padding:1px 4px;font-size:9px;border-radius:3px;}"
        )
        combo.currentIndexChanged.connect(self._sync_and_emit)
        return combo

    def _get_cb(self, row: int, col: int) -> QCheckBox | None:
        cw = self.cellWidget(row, col)
        return cw.findChild(QCheckBox) if cw else None

    def _get_type_combo(self, row: int) -> QComboBox | None:
        return self.cellWidget(row, 4)

    def _on_item_changed(self, item: QTableWidgetItem) -> None:
        if self._loading or item.column() != 1:
            return
        row = item.row()
        if row < len(self._fcs):
            self._fcs[row].alias = item.text().strip() or self._fcs[row].name
        self._sync_and_emit()

    def _sync_and_emit(self) -> None:
        if self._loading:
            return
        for i, fc in enumerate(self._fcs):
            cb_p  = self._get_cb(i, 2)
            cb_t  = self._get_cb(i, 3)
            combo = self._get_type_combo(i)
            if cb_p:  fc.in_popup   = cb_p.isChecked()
            if cb_t:  fc.in_table   = cb_t.isChecked()
            if combo: fc.field_type = self._TYPE_VALUES[combo.currentIndex()]
        self.changed.emit()
