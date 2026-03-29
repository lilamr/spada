"""
spada.gui.styles
~~~~~~~~~~~~~~~~~
Konstanta Qt stylesheet untuk dark theme SpaDa.
"""

APP_DARK = """
QMainWindow, QWidget {
    background: #0f1117;
    color: #e2e8f0;
    font-family: 'Segoe UI', sans-serif;
    font-size: 13px;
}
QGroupBox {
    border: 1px solid #2d3250;
    border-radius: 8px;
    margin-top: 10px;
    padding-top: 10px;
    background: #1a1d27;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 10px;
    color: #818cf8;
    font-size: 11px;
    font-weight: bold;
}
QLabel { color: #94a3b8; }
QComboBox {
    background: #22263a;
    border: 1px solid #2d3250;
    border-radius: 6px;
    padding: 4px 8px;
    color: #e2e8f0;
}
QComboBox:hover, QComboBox:focus { border-color: #6366f1; }
QComboBox::drop-down { border: none; }
QComboBox QAbstractItemView {
    background: #22263a;
    border: 1px solid #2d3250;
    selection-background-color: #6366f1;
}
QSpinBox, QDoubleSpinBox {
    background: #22263a;
    border: 1px solid #2d3250;
    border-radius: 6px;
    padding: 4px 6px;
    color: #e2e8f0;
}
QSpinBox:hover, QDoubleSpinBox:hover { border-color: #6366f1; }
QSlider::groove:horizontal {
    height: 4px;
    background: #2d3250;
    border-radius: 2px;
}
QSlider::handle:horizontal {
    width: 14px;
    height: 14px;
    background: #6366f1;
    border-radius: 7px;
    margin: -5px 0;
}
QSlider::sub-page:horizontal { background: #6366f1; border-radius: 2px; }
QCheckBox { color: #e2e8f0; spacing: 6px; }
QCheckBox::indicator {
    width: 16px;
    height: 16px;
    border: 1.5px solid #2d3250;
    border-radius: 4px;
    background: #22263a;
}
QCheckBox::indicator:checked { background: #6366f1; border-color: #6366f1; }
QPushButton {
    background: #22263a;
    border: 1px solid #2d3250;
    border-radius: 6px;
    padding: 6px 14px;
    color: #e2e8f0;
}
QPushButton:hover { border-color: #6366f1; color: #818cf8; }
QPushButton:pressed { background: #6366f1; color: white; }
QListWidget {
    background: #1a1d27;
    border: 1px solid #2d3250;
    border-radius: 8px;
}
QListWidget::item { padding: 8px; border-radius: 4px; color: #e2e8f0; }
QListWidget::item:selected { background: #6366f1; color: white; }
QListWidget::item:hover { background: #22263a; }
QSplitter::handle { background: #2d3250; width: 2px; }
QScrollArea { border: none; background: transparent; }
QStatusBar {
    background: #1a1d27;
    color: #64748b;
    border-top: 1px solid #2d3250;
    font-size: 11px;
}
QToolBar {
    background: #1a1d27;
    border-bottom: 1px solid #2d3250;
    spacing: 4px;
    padding: 4px;
}
QLineEdit {
    background: #22263a;
    border: 1px solid #2d3250;
    border-radius: 6px;
    padding: 6px 10px;
    color: #e2e8f0;
}
QLineEdit:focus { border-color: #6366f1; }
QMenuBar { background: #1a1d27; color: #e2e8f0; border-bottom: 1px solid #2d3250; }
QMenuBar::item:selected { background: #6366f1; }
QMenu { background: #1a1d27; border: 1px solid #2d3250; color: #e2e8f0; }
QMenu::item:selected { background: #6366f1; }
"""

GROUP_BOX = """
QGroupBox {
    border: 1px solid #2d3250;
    border-radius: 8px;
    margin-top: 10px;
    padding-top: 8px;
    background: #1a1d27;
}
QGroupBox::title {
    subcontrol-origin: margin;
    left: 10px;
    color: #818cf8;
    font-size: 10px;
    font-weight: bold;
}
"""

FIELD_TABLE = """
QTableWidget {
    background: #1a1d27;
    border: 1px solid #2d3250;
    border-radius: 6px;
    gridline-color: #2d3250;
    font-size: 11px;
}
QTableWidget::item { padding: 3px 6px; color: #e2e8f0; }
QHeaderView::section {
    background: #22263a;
    color: #64748b;
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
    padding: 4px 6px;
    border: none;
    border-bottom: 1px solid #2d3250;
}
QCheckBox { margin-left: 4px; }
QCheckBox::indicator {
    width: 14px; height: 14px;
    border: 1.5px solid #2d3250;
    border-radius: 3px;
    background: #22263a;
}
QCheckBox::indicator:checked { background: #6366f1; border-color: #6366f1; }
"""
