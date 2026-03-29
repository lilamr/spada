#!/usr/bin/env python3
"""
SpaDa — entry point utama.

Jalankan dengan:
    python main.py
atau setelah install:
    spada
"""

import sys
from pathlib import Path

from PyQt5.QtWidgets import QApplication
from PyQt5.QtGui import QFont, QIcon

from spada.gui.main_window import SpadaWindow

_ICON = Path(__file__).parent / "spada" / "resources" / "icon.png"


def main() -> None:
    app = QApplication(sys.argv)
    app.setApplicationName("SpaDa")
    app.setApplicationDisplayName("SpaDa — Spasial Dashboard")
    app.setOrganizationName("SpaDa")
    app.setFont(QFont("Segoe UI", 10))
    if _ICON.exists():
        app.setWindowIcon(QIcon(str(_ICON)))

    window = SpadaWindow()
    window.show()

    sys.exit(app.exec_())


if __name__ == "__main__":
    main()
