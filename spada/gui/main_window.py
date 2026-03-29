"""
spada.gui.main_window
~~~~~~~~~~~~~~~~~~~~~~
Jendela utama SpaDa v1.0.0
"""

from __future__ import annotations

import base64
import os
import traceback
from pathlib import Path

from PyQt5.QtWidgets import (
    QMainWindow, QWidget, QVBoxLayout, QHBoxLayout,
    QSplitter, QListWidget, QListWidgetItem, QScrollArea,
    QFrame, QStatusBar, QToolBar, QAction, QFileDialog,
    QMessageBox, QDialog, QDialogButtonBox, QLineEdit, QLabel,
    QApplication, QAbstractItemView, QPushButton, QMenu,
    QFormLayout,
)
from PyQt5.QtCore import Qt, QSize
from PyQt5.QtGui import QColor, QPixmap, QIcon

from ..core.layer import LayerData
from ..core.exporter import HtmlExporter
from ..core import project as proj
from .style_panel import StylePanel
from .preview import MapPreviewWidget
from .styles import APP_DARK


class SpadaWindow(QMainWindow):
    """Jendela utama SpaDa — Spasial Dashboard v1.0.0"""

    APP_TITLE       = "SpaDa — Spasial Dashboard v1.0.0"
    MIN_SIZE        = (1100, 680)
    DEF_SIZE        = (1380, 840)
    SIDEBAR_WIDTH   = 310
    SIDEBAR_MINIMUM = 260

    def __init__(self) -> None:
        super().__init__()
        self.layers: list[LayerData] = []
        self._active_idx: int = -1
        self._sidebar_visible: bool = True
        self._logo_b64: str | None = None
        self._app_name: str = "SpaDa"
        self._app_sub:  str = "Spasial Dashboard"
        self._project_path: str | None = None   # path project yang sedang dibuka

        self.setWindowTitle(self.APP_TITLE)
        self.setMinimumSize(*self.MIN_SIZE)
        self.resize(*self.DEF_SIZE)
        self.setStyleSheet(APP_DARK)
        # Ikon aplikasi
        _icon = Path(__file__).parent.parent / "resources" / "icon.png"
        if _icon.exists():
            self.setWindowIcon(QIcon(str(_icon)))

        self._build_ui()
        self._build_menu()
        self._build_toolbar()

    # ══════════════════════════════════════════
    #  UI Construction
    # ══════════════════════════════════════════

    def _build_menu(self) -> None:
        mb = self.menuBar()

        fm = mb.addMenu("File")
        fm.addAction("Proyek Baru",        self.new_project,       "Ctrl+N")
        fm.addAction("Buka Proyek…",       self.open_project,      "Ctrl+Shift+O")
        fm.addSeparator()
        fm.addAction("Simpan",             self.save_project,      "Ctrl+S")
        fm.addAction("Simpan Sebagai…",    self.save_project_as,   "Ctrl+Shift+S")
        fm.addSeparator()
        fm.addAction("Export Dashboard…",  self.export_html,       "Ctrl+E")
        fm.addSeparator()
        fm.addAction("Keluar",             self.close,             "Ctrl+Q")

        lm = mb.addMenu("Layer")
        lm.addAction("Tambah Layer…",          self.add_layer,         "Ctrl+O")
        lm.addSeparator()
        lm.addAction("Rename Layer",           self._rename_selected)
        lm.addAction("Hapus Layer Terpilih",   self.remove_layer,      "Del")
        lm.addSeparator()
        lm.addAction("Pindah ke Atas",         self.move_layer_up)
        lm.addAction("Pindah ke Bawah",        self.move_layer_down)

        vm = mb.addMenu("Tampilan")
        vm.addAction("Toggle Sidebar",         self._toggle_sidebar, "Ctrl+B")

        sm = mb.addMenu("Pengaturan")
        sm.addAction("Identitas Aplikasi…",    self._edit_identity)

        hm = mb.addMenu("Bantuan")
        hm.addAction("Tentang SpaDa",          self._show_about)

    def _build_toolbar(self) -> None:
        tb: QToolBar = self.addToolBar("Main")
        tb.setMovable(False)
        tb.setIconSize(QSize(16, 16))
        tb.setToolButtonStyle(Qt.ToolButtonTextBesideIcon)

        self._sidebar_act = QAction("◀ Sidebar", self)
        self._sidebar_act.setToolTip("Tampilkan / Sembunyikan Sidebar (Ctrl+B)")
        self._sidebar_act.triggered.connect(self._toggle_sidebar)
        tb.addAction(self._sidebar_act)
        tb.addSeparator()

        for label, slot in [
            ("➕  Layer",    self.add_layer),
            ("💾  Simpan",   self.save_project),
            ("🌐  Export",   self.export_html),
            ("🗑  Hapus",    self.remove_layer),
            ("✏️  Rename",   self._rename_selected),
            ("🏷  Identitas", self._edit_identity),
        ]:
            act = QAction(label, self)
            act.triggered.connect(slot)
            tb.addAction(act)
            tb.addSeparator()

    def _build_ui(self) -> None:
        central = QWidget()
        self.setCentralWidget(central)
        root = QHBoxLayout(central)
        root.setContentsMargins(0, 0, 0, 0)
        root.setSpacing(0)

        self._splitter = QSplitter(Qt.Horizontal)
        self._splitter.setHandleWidth(2)
        self._left_panel = self._build_left_panel()
        self._splitter.addWidget(self._left_panel)
        self._preview = MapPreviewWidget()
        self._splitter.addWidget(self._preview)
        self._splitter.setSizes([self.SIDEBAR_WIDTH, 1050])
        root.addWidget(self._splitter)

        self._status = QStatusBar()
        self.setStatusBar(self._status)
        self._status.showMessage(
            "SpaDa v1.0.0 — Tambahkan layer spasial untuk membuat dashboard"
        )

    def _build_left_panel(self) -> QWidget:
        panel = QWidget()
        panel.setMinimumWidth(self.SIDEBAR_MINIMUM)
        panel.setMaximumWidth(420)
        lay = QVBoxLayout(panel)
        lay.setContentsMargins(0, 0, 0, 0)
        lay.setSpacing(0)

        hdr = QWidget()
        hdr.setFixedHeight(32)
        hdr.setStyleSheet("background:#1a1d27;border-bottom:1px solid #2d3250;")
        hdr_lay = QHBoxLayout(hdr)
        hdr_lay.setContentsMargins(10, 0, 6, 0)

        self._logo_preview = QLabel()
        self._logo_preview.setFixedSize(20, 20)
        self._logo_preview.setToolTip("Klik untuk ganti identitas")
        self._logo_preview.setCursor(Qt.PointingHandCursor)
        self._logo_preview.mousePressEvent = lambda _: self._edit_identity()
        hdr_lay.addWidget(self._logo_preview)

        title_lbl = QLabel("LAYER")
        title_lbl.setStyleSheet(
            "color:#64748b;font-size:10px;font-weight:bold;letter-spacing:1.5px;"
        )
        hdr_lay.addWidget(title_lbl)
        hdr_lay.addStretch()
        lay.addWidget(hdr)

        self._layer_list = QListWidget()
        self._layer_list.setDragDropMode(QAbstractItemView.InternalMove)
        self._layer_list.setFixedHeight(160)
        self._layer_list.currentRowChanged.connect(self._on_layer_select)
        self._layer_list.itemDoubleClicked.connect(
            lambda item: self._do_rename(self._layer_list.row(item))
        )
        self._layer_list.setContextMenuPolicy(Qt.CustomContextMenu)
        self._layer_list.customContextMenuRequested.connect(self._layer_context_menu)
        self._layer_list.model().rowsMoved.connect(self._on_layer_reorder)
        lay.addWidget(self._layer_list)

        scroll = QScrollArea()
        scroll.setWidgetResizable(True)
        scroll.setFrameShape(QFrame.NoFrame)
        self._style_panel = StylePanel()
        self._style_panel.styleChanged.connect(self._on_style_changed)
        scroll.setWidget(self._style_panel)
        lay.addWidget(scroll, 1)

        return panel

    # ══════════════════════════════════════════
    #  Sidebar Toggle
    # ══════════════════════════════════════════

    def _toggle_sidebar(self) -> None:
        self._sidebar_visible = not self._sidebar_visible
        self._left_panel.setVisible(self._sidebar_visible)
        self._splitter.setSizes(
            [self.SIDEBAR_WIDTH, 9999] if self._sidebar_visible else [0, 9999]
        )
        self._sidebar_act.setText(
            "◀ Sidebar" if self._sidebar_visible else "▶ Sidebar"
        )
        try:
            if hasattr(self._preview, "_web"):
                self._preview._web.page().runJavaScript(
                    "if(typeof map!=='undefined') setTimeout(()=>map.invalidateSize(),260);"
                )
        except Exception:
            pass

    # ══════════════════════════════════════════
    #  Identitas Aplikasi
    # ══════════════════════════════════════════

    def _edit_identity(self) -> None:
        dlg = QDialog(self)
        dlg.setWindowTitle("Identitas Aplikasi")
        dlg.setFixedWidth(380)
        dlg.setStyleSheet(APP_DARK)
        lay = QVBoxLayout(dlg)
        lay.setSpacing(12)

        form = QFormLayout()
        form.setSpacing(8)
        name_edit = QLineEdit(self._app_name)
        name_edit.setPlaceholderText("contoh: SpaDa")
        form.addRow("Nama Aplikasi:", name_edit)
        sub_edit = QLineEdit(self._app_sub)
        sub_edit.setPlaceholderText("contoh: Spasial Dashboard")
        form.addRow("Subjudul:", sub_edit)
        lay.addLayout(form)

        logo_row = QHBoxLayout()
        self._logo_path_lbl = QLabel(
            "Logo: (default)" if not self._logo_b64 else "Logo: (custom)"
        )
        self._logo_path_lbl.setStyleSheet("color:#64748b;font-size:10px;")
        logo_row.addWidget(self._logo_path_lbl)
        logo_row.addStretch()
        _btn_style = (
            "QPushButton{background:#22263a;border:1px solid #2d3250;"
            "color:#e2e8f0;padding:4px 10px;border-radius:4px;font-size:10px;}"
            "QPushButton:hover{border-color:#6366f1;}"
        )
        btn_logo  = QPushButton("Pilih Gambar…")
        btn_reset = QPushButton("Reset")
        btn_logo.setStyleSheet(_btn_style)
        btn_reset.setStyleSheet(_btn_style)
        logo_row.addWidget(btn_logo)
        logo_row.addWidget(btn_reset)
        lay.addLayout(logo_row)

        hint = QLabel("Nama & subjudul tampil di header dashboard HTML.\nLogo: PNG, JPG, SVG, WebP.")
        hint.setStyleSheet("color:#64748b;font-size:9px;")
        hint.setWordWrap(True)
        lay.addWidget(hint)

        btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        btns.accepted.connect(dlg.accept)
        btns.rejected.connect(dlg.reject)
        lay.addWidget(btns)

        _tmp_logo: list[str | None] = [self._logo_b64]

        def pick_logo():
            path, _ = QFileDialog.getOpenFileName(
                dlg, "Pilih Gambar Logo", "",
                "Gambar (*.png *.jpg *.jpeg *.svg *.webp *.bmp *.gif)",
            )
            if not path:
                return
            try:
                with open(path, "rb") as f:
                    data = f.read()
                ext  = Path(path).suffix.lower().lstrip(".")
                mime = {"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png",
                        "svg":"image/svg+xml","webp":"image/webp",
                        "bmp":"image/bmp","gif":"image/gif"}.get(ext,"image/png")
                _tmp_logo[0] = f"data:{mime};base64,{base64.b64encode(data).decode()}"
                self._logo_path_lbl.setText(f"Logo: {Path(path).name}")
            except Exception:
                QMessageBox.critical(dlg, "Gagal Memuat Logo", traceback.format_exc())

        def reset_logo():
            _tmp_logo[0] = None
            self._logo_path_lbl.setText("Logo: (default)")

        btn_logo.clicked.connect(pick_logo)
        btn_reset.clicked.connect(reset_logo)

        if dlg.exec_() == QDialog.Accepted:
            self._app_name = name_edit.text().strip() or "SpaDa"
            self._app_sub  = sub_edit.text().strip() or "Spasial Dashboard"
            self._logo_b64 = _tmp_logo[0]
            # Update thumbnail
            if self._logo_b64:
                try:
                    raw = base64.b64decode(self._logo_b64.split(",", 1)[1])
                    px = QPixmap(); px.loadFromData(raw)
                    self._logo_preview.setPixmap(
                        px.scaled(20, 20, Qt.KeepAspectRatio, Qt.SmoothTransformation)
                    )
                except Exception:
                    self._logo_preview.clear()
            else:
                self._logo_preview.clear()
            self._status.showMessage(
                f"Identitas: '{self._app_name}' / '{self._app_sub}'"
            )
            self._refresh_preview()

    # ══════════════════════════════════════════
    #  Project: New / Open / Save
    # ══════════════════════════════════════════

    def new_project(self) -> None:
        if self.layers:
            reply = QMessageBox.question(
                self, "Proyek Baru",
                "Buat proyek baru? Semua layer yang belum disimpan akan hilang.",
                QMessageBox.Yes | QMessageBox.No,
            )
            if reply != QMessageBox.Yes:
                return
        self.layers.clear()
        self._layer_list.clear()
        self._active_idx = -1
        self._logo_b64 = None
        self._app_name = "SpaDa"
        self._app_sub  = "Spasial Dashboard"
        self._project_path = None
        self._logo_preview.clear()
        self._refresh_preview()
        self.setWindowTitle(self.APP_TITLE)
        self._status.showMessage("Proyek baru dibuat.")

    def open_project(self) -> None:
        path, _ = QFileDialog.getOpenFileName(
            self, "Buka Proyek SpaDa", "", "SpaDa Project (*.spd);;Semua File (*)"
        )
        if not path:
            return
        try:
            layers, settings, errors = proj.load(path)
        except Exception:
            QMessageBox.critical(self, "Gagal Membuka Proyek", traceback.format_exc())
            return

        self.layers = layers
        self._app_name = settings["app_name"]
        self._app_sub  = settings["app_sub"]
        self._logo_b64 = settings["logo_b64"]

        # Rebuild layer list
        self._layer_list.clear()
        for layer in self.layers:
            item = QListWidgetItem(f"◉  {layer.name}")
            item.setForeground(QColor(layer.fill_color))
            item.setToolTip(f"{layer.path}\n{layer.feature_count:,} fitur | {layer.geom_type}")
            self._layer_list.addItem(item)

        # Update logo thumbnail
        if self._logo_b64:
            try:
                raw = base64.b64decode(self._logo_b64.split(",", 1)[1])
                px = QPixmap(); px.loadFromData(raw)
                self._logo_preview.setPixmap(
                    px.scaled(20, 20, Qt.KeepAspectRatio, Qt.SmoothTransformation)
                )
            except Exception:
                self._logo_preview.clear()
        else:
            self._logo_preview.clear()

        self.setWindowTitle(f"{self.APP_TITLE} — {Path(path).name}")
        self._project_path = path
        self._status.showMessage(f"Proyek dibuka: {path}")
        self._refresh_preview()

        if errors:
            QMessageBox.warning(
                self, "Beberapa Layer Gagal Dimuat",
                "\n\n".join(errors)
            )

    def save_project(self) -> None:
        """Simpan ke path yang sudah ada. Jika belum ada, buka dialog."""
        if not self.layers:
            QMessageBox.information(
                self, "Tidak Ada Layer", "Tambahkan minimal satu layer sebelum menyimpan."
            )
            return
        if self._project_path:
            self._do_save(self._project_path)
        else:
            self.save_project_as()

    def save_project_as(self) -> None:
        """Simpan ke path baru — selalu buka dialog."""
        if not self.layers:
            QMessageBox.information(
                self, "Tidak Ada Layer", "Tambahkan minimal satu layer sebelum menyimpan."
            )
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Simpan Proyek SpaDa", "proyek.spd", "SpaDa Project (*.spd)"
        )
        if not path:
            return
        self._do_save(path)

    def _do_save(self, path: str) -> None:
        try:
            proj.save(
                path, self.layers,
                app_name=self._app_name,
                app_sub=self._app_sub,
                logo_b64=self._logo_b64,
            )
            self._project_path = path
            self.setWindowTitle(f"{self.APP_TITLE} — {Path(path).name}")
            self._status.showMessage(f"✓ Proyek disimpan: {path}")
        except Exception:
            QMessageBox.critical(self, "Gagal Menyimpan Proyek", traceback.format_exc())

    # ══════════════════════════════════════════
    #  Layer Management
    # ══════════════════════════════════════════

    def add_layer(self) -> None:
        files, _ = QFileDialog.getOpenFileNames(
            self, "Buka File Spasial", "",
            "Semua Format Spasial (*.shp *.geojson *.json *.kml *.gpkg *.gml *.zip);;"
            "Shapefile (*.shp);;GeoJSON (*.geojson *.json);;KML (*.kml);;"
            "GeoPackage (*.gpkg);;GML (*.gml);;ZIP (*.zip);;Semua File (*)",
        )
        for path in files:
            self._load_layer(path)

    def _load_layer(self, path: str) -> None:
        self._status.showMessage(f"Memuat {Path(path).name}…")
        QApplication.processEvents()
        try:
            layer = LayerData(path)
            if layer.gdf.empty:
                QMessageBox.warning(
                    self, "Layer Kosong",
                    f"Layer '{layer.name}' tidak memiliki geometri valid."
                )
                return
            self.layers.append(layer)
            item = QListWidgetItem(f"◉  {layer.name}")
            item.setForeground(QColor(layer.fill_color))
            item.setToolTip(
                f"{path}\n{layer.feature_count:,} fitur | {layer.geom_type}"
            )
            self._layer_list.addItem(item)
            self._layer_list.setCurrentRow(len(self.layers) - 1)
            self._status.showMessage(
                f"✓ {layer.name} — {layer.feature_count:,} fitur | {layer.geom_type}"
            )
            self._refresh_preview(fast=True)
        except Exception:
            QMessageBox.critical(
                self, "Gagal Memuat Layer", f"Error:\n\n{traceback.format_exc()}"
            )
            self._status.showMessage("Gagal memuat layer.")

    def remove_layer(self) -> None:
        row = self._layer_list.currentRow()
        if row < 0:
            return
        name = self.layers[row].name
        self._layer_list.takeItem(row)
        self.layers.pop(row)
        self._active_idx = -1
        self._status.showMessage(f"Layer '{name}' dihapus.")
        self._refresh_preview()

    def move_layer_up(self) -> None:
        row = self._layer_list.currentRow()
        if row <= 0:
            return
        self.layers[row], self.layers[row-1] = self.layers[row-1], self.layers[row]
        item = self._layer_list.takeItem(row)
        self._layer_list.insertItem(row-1, item)
        self._layer_list.setCurrentRow(row-1)
        self._refresh_preview()

    def move_layer_down(self) -> None:
        row = self._layer_list.currentRow()
        if row < 0 or row >= len(self.layers)-1:
            return
        self.layers[row], self.layers[row+1] = self.layers[row+1], self.layers[row]
        item = self._layer_list.takeItem(row)
        self._layer_list.insertItem(row+1, item)
        self._layer_list.setCurrentRow(row+1)
        self._refresh_preview()

    def _on_layer_reorder(self) -> None:
        """Sync self.layers setelah drag-drop di QListWidget."""
        new_layers = []
        for i in range(self._layer_list.count()):
            name = self._layer_list.item(i).text().lstrip("◉ ")
            match = next((l for l in self.layers if l.name == name), None)
            if match:
                new_layers.append(match)
        if len(new_layers) == len(self.layers):
            self.layers = new_layers
            self._refresh_preview()

    def _rename_selected(self) -> None:
        row = self._layer_list.currentRow()
        if row >= 0:
            self._do_rename(row)

    def _do_rename(self, row: int) -> None:
        layer = self.layers[row]
        dlg = QDialog(self)
        dlg.setWindowTitle("Rename Layer")
        dlg.setFixedWidth(320)
        dlg.setStyleSheet(APP_DARK)
        lay = QVBoxLayout(dlg)
        lay.addWidget(QLabel("Nama baru layer:"))
        edit = QLineEdit(layer.name)
        edit.selectAll()
        lay.addWidget(edit)
        btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        btns.accepted.connect(dlg.accept)
        btns.rejected.connect(dlg.reject)
        lay.addWidget(btns)
        if dlg.exec_() == QDialog.Accepted:
            new_name = edit.text().strip()
            if new_name and new_name != layer.name:
                layer.name = new_name
                self._layer_list.item(row).setText(f"◉  {new_name}")
                self._status.showMessage(f"Layer di-rename ke '{new_name}'.")
                self._refresh_preview()

    def _layer_context_menu(self, pos) -> None:
        row = self._layer_list.currentRow()
        if row < 0:
            return
        menu = QMenu(self)
        menu.setStyleSheet(
            "QMenu{background:#1a1d27;border:1px solid #2d3250;color:#e2e8f0;}"
            "QMenu::item:selected{background:#6366f1;}"
        )
        menu.addAction("✏️ Rename",         lambda: self._do_rename(row))
        menu.addAction("🗑 Hapus Layer",     self.remove_layer)
        menu.addSeparator()
        menu.addAction("⬆ Pindah ke Atas",  self.move_layer_up)
        menu.addAction("⬇ Pindah ke Bawah", self.move_layer_down)
        menu.exec_(self._layer_list.mapToGlobal(pos))

    # ══════════════════════════════════════════
    #  Export
    # ══════════════════════════════════════════

    def export_html(self) -> None:
        if not self.layers:
            QMessageBox.information(
                self, "Tidak Ada Layer",
                "Tambahkan minimal satu layer sebelum export."
            )
            return
        path, _ = QFileDialog.getSaveFileName(
            self, "Export Dashboard", "spada_dashboard.html", "HTML Files (*.html)"
        )
        if not path:
            return
        title, ok = self._ask_title()
        if not ok:
            return
        self._status.showMessage("Mengekspor dashboard…")
        QApplication.processEvents()
        try:
            html = HtmlExporter().build(
                self.layers, title,
                logo_b64=self._logo_b64,
                app_name=self._app_name,
                app_sub=self._app_sub,
            )
            with open(path, "w", encoding="utf-8") as f:
                f.write(html)
            size_kb = os.path.getsize(path) / 1024
            self._status.showMessage(f"✓ Dashboard: {path} ({size_kb:.0f} KB)")
            reply = QMessageBox.question(
                self, "Export Berhasil",
                f"Dashboard disimpan di:\n{path}\n\nBuka di browser sekarang?",
                QMessageBox.Yes | QMessageBox.No,
            )
            if reply == QMessageBox.Yes:
                import webbrowser
                webbrowser.open(f"file://{os.path.abspath(path)}")
        except Exception:
            QMessageBox.critical(self, "Gagal Export", traceback.format_exc())
            self._status.showMessage("Export gagal.")

    # ══════════════════════════════════════════
    #  Slots & Helpers
    # ══════════════════════════════════════════

    def _on_layer_select(self, row: int) -> None:
        if 0 <= row < len(self.layers):
            self._active_idx = row
            self._style_panel.load_layer(self.layers[row])

    def _on_style_changed(self) -> None:
        row = self._layer_list.currentRow()
        if 0 <= row < len(self.layers):
            self._layer_list.item(row).setForeground(
                QColor(self.layers[row].fill_color)
            )
        self._refresh_preview(fast=False)

    def _refresh_preview(self, fast: bool = True) -> None:
        self._preview.update_preview(
            layers   = self.layers,
            logo_b64 = self._logo_b64,
            app_name = self._app_name,
            app_sub  = self._app_sub,
            fast     = fast,
        )

    def _ask_title(self) -> tuple[str, bool]:
        dlg = QDialog(self)
        dlg.setWindowTitle("Judul Dashboard")
        dlg.setFixedWidth(360)
        dlg.setStyleSheet(APP_DARK)
        lay = QVBoxLayout(dlg)
        lay.addWidget(QLabel("Judul dashboard yang ditampilkan di HTML:"))
        edit = QLineEdit("Dashboard Spasial")
        lay.addWidget(edit)
        btns = QDialogButtonBox(QDialogButtonBox.Ok | QDialogButtonBox.Cancel)
        btns.accepted.connect(dlg.accept)
        btns.rejected.connect(dlg.reject)
        lay.addWidget(btns)
        ok = dlg.exec_() == QDialog.Accepted
        return (edit.text().strip() or "Dashboard Spasial"), ok

    def _show_about(self) -> None:
        QMessageBox.about(
            self, "Tentang SpaDa",
            "<b>SpaDa — Spasial Dashboard v1.0.0</b><br><br>"
            "Aplikasi desktop untuk membuat dashboard visualisasi data spasial interaktif.<br><br>"
            "Format input: SHP, GeoJSON, KML, GPKG, GML<br>"
            "Output: HTML standalone (Leaflet + Chart.js)<br><br>"
            "<small>Dibuat dengan PyQt5 dan GeoPandas</small>",
        )
