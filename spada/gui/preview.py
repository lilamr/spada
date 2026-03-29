"""
spada.gui.preview
~~~~~~~~~~~~~~~~~~
Widget live preview dashboard (QWebEngineView + Leaflet).

Fix CDN blocking:
- Set LocalContentCanAccessRemoteUrls di DEFAULT PROFILE (bukan hanya view settings)
- Set AllowRunningInsecureContent di profile juga
- Gunakan page().setHtml() dengan baseUrl = QUrl("https://unpkg.com") supaya
  Chromium menganggap origin HTTPS, bukan null/file://, sehingga CDN bisa dimuat
- Logo dan app_name/app_sub diterima dan diteruskan ke HtmlExporter
"""

from __future__ import annotations

import os
import tempfile

from PyQt5.QtCore import Qt, QTimer, QUrl
from PyQt5.QtWidgets import QHBoxLayout, QLabel, QVBoxLayout, QWidget

try:
    from PyQt5.QtWebEngineWidgets import (
        QWebEngineProfile,
        QWebEngineSettings,
        QWebEngineView,
    )
    HAS_WEBENGINE = True
except ImportError:
    HAS_WEBENGINE = False

from ..core.exporter import HtmlExporter
from ..core.layer import LayerData

_EMPTY_HTML = """<!DOCTYPE html><html>
<body style="background:#0f1117;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0;font-family:'Segoe UI',sans-serif;color:#64748b;text-align:center;">
  <div>
    <div style="font-size:48px;margin-bottom:16px">🗺</div>
    <div style="font-size:13px;font-weight:600;color:#94a3b8">SpaDa</div>
    <div style="font-size:11px;margin-top:6px">Tambahkan layer spasial untuk memulai</div>
  </div>
</body></html>"""

# Base URL yang diberikan ke setHtml() agar Chromium menganggap origin = HTTPS
_BASE_URL = QUrl("https://unpkg.com") if HAS_WEBENGINE else None


def _setup_profile() -> None:
    """
    Set LocalContentCanAccessRemoteUrls di DEFAULT PROFILE.
    Harus dipanggil SETELAH QApplication dibuat — jadi dipanggil
    dari dalam MapPreviewWidget.__init__, bukan di module level.
    """
    if not HAS_WEBENGINE:
        return
    profile = QWebEngineProfile.defaultProfile()
    ps = profile.settings()
    ps.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
    ps.setAttribute(QWebEngineSettings.LocalContentCanAccessFileUrls, True)
    ps.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)
    ps.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
    ps.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)


class MapPreviewWidget(QWidget):
    """Live preview dashboard Leaflet di dalam GUI."""

    DEBOUNCE_STYLE_MS = 400
    DEBOUNCE_LAYER_MS = 100

    def __init__(self, parent=None) -> None:
        super().__init__(parent)
        # Dipanggil di sini — QApplication sudah pasti ada saat widget dibuat
        _setup_profile()

        self._layers: list[LayerData] = []
        self._logo_b64: str | None = None
        self._app_name: str = "SpaDa"
        self._app_sub: str = "Spasial Dashboard"

        self._timer = QTimer(parent=self)
        self._timer.setSingleShot(True)
        self._timer.timeout.connect(self._do_refresh)

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        layout.addWidget(self._build_topbar())

        if HAS_WEBENGINE:
            self._web = QWebEngineView()
            # Log JS errors ke terminal agar mudah debug
            self._web.page().javaScriptConsoleMessage = self._on_js_console
            # Set di view-level juga (defense in depth)
            s = self._web.settings()
            s.setAttribute(QWebEngineSettings.LocalContentCanAccessRemoteUrls, True)
            s.setAttribute(QWebEngineSettings.LocalContentCanAccessFileUrls, True)
            s.setAttribute(QWebEngineSettings.AllowRunningInsecureContent, True)
            s.setAttribute(QWebEngineSettings.JavascriptEnabled, True)
            s.setAttribute(QWebEngineSettings.LocalStorageEnabled, True)
            layout.addWidget(self._web)
            self._show_empty()
        else:
            layout.addWidget(self._build_fallback())

    def _on_js_console(self, level, message, line, source):
        """Teruskan JS console error ke terminal Python."""
        levels = {0: "INFO", 1: "WARN", 2: "ERROR"}
        lvl = levels.get(level, "LOG")
        print(f"[JS {lvl}] {message}  (line {line}, {source})")

    # ── Public API ────────────────────────────

    def update_preview(
        self,
        layers: list[LayerData],
        logo_b64: str | None = None,
        app_name: str = "SpaDa",
        app_sub: str = "Spasial Dashboard",
        fast: bool = False,
    ) -> None:
        """Satu method tunggal untuk update semua state preview sekaligus."""
        self._layers   = layers
        self._logo_b64 = logo_b64
        self._app_name = app_name
        self._app_sub  = app_sub
        delay = self.DEBOUNCE_LAYER_MS if fast else self.DEBOUNCE_STYLE_MS
        self._timer.stop()
        self._timer.start(delay)

    # Backward-compat helpers (dipanggil dari style_panel)
    def set_layers(self, layers: list[LayerData], fast: bool = False) -> None:
        self._layers = layers
        delay = self.DEBOUNCE_LAYER_MS if fast else self.DEBOUNCE_STYLE_MS
        self._timer.stop()
        self._timer.start(delay)

    def set_logo(self, logo_b64: str | None) -> None:
        self._logo_b64 = logo_b64
        self._timer.stop()
        self._timer.start(self.DEBOUNCE_LAYER_MS)

    # ── Private ───────────────────────────────

    def _build_topbar(self) -> QWidget:
        bar = QWidget()
        bar.setFixedHeight(28)
        bar.setStyleSheet("background:#1a1d27;border-bottom:1px solid #2d3250;")
        lay = QHBoxLayout(bar)
        lay.setContentsMargins(10, 0, 10, 0)
        live = QLabel("● LIVE PREVIEW")
        live.setStyleSheet(
            "color:#10b981;font-size:9px;font-weight:bold;letter-spacing:1.5px;"
        )
        lay.addWidget(live)
        lay.addStretch()
        self._info = QLabel("")
        self._info.setStyleSheet("color:#64748b;font-size:9px;")
        lay.addWidget(self._info)
        return bar

    def _build_fallback(self) -> QLabel:
        lbl = QLabel(
            "⚠  PyQtWebEngine tidak tersedia.\n\n"
            "Install: pip install PyQtWebEngine\n\n"
            "Preview tidak tampil di GUI,\n"
            "tapi Export Dashboard tetap berfungsi."
        )
        lbl.setAlignment(Qt.AlignCenter)
        lbl.setStyleSheet(
            "color:#f59e0b;font-size:13px;background:#1a1d27;padding:40px;"
        )
        return lbl

    def _show_empty(self) -> None:
        if not HAS_WEBENGINE:
            return
        # Untuk halaman kosong gunakan setHtml biasa (tidak butuh CDN)
        self._web.setHtml(_EMPTY_HTML)
        self._info.setText("")

    def _do_refresh(self) -> None:
        if not HAS_WEBENGINE:
            return
        if not self._layers:
            self._show_empty()
            return

        html = HtmlExporter().build(
            self._layers,
            title="Preview",
            logo_b64=self._logo_b64,
            app_name=self._app_name,
            app_sub=self._app_sub,
        )

        # Tulis ke temp file lalu load via file://.
        # LocalContentCanAccessRemoteUrls yang sudah di-set di profile
        # memungkinkan file:// origin mengakses CDN eksternal.
        tmp = getattr(self, "_tmp_file", None)
        if tmp:
            try:
                os.unlink(tmp)
            except OSError:
                pass

        fd, path = tempfile.mkstemp(suffix=".html", prefix="spada_preview_")
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(html)
        self._tmp_file = path
        self._web.load(QUrl.fromLocalFile(path))

        n = sum(lyr.feature_count for lyr in self._layers)
        self._info.setText(f"{len(self._layers)} layer · {n:,} fitur")

    def closeEvent(self, event):
        tmp = getattr(self, "_tmp_file", None)
        if tmp:
            try:
                os.unlink(tmp)
            except OSError:
                pass
        super().closeEvent(event)
