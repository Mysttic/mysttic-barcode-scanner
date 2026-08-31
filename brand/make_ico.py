#!/usr/bin/env python3
"""Sklada brand/icon-256.png w plik .ico dla aplikacji Windows.

Wymaga wczesniejszego uruchomienia `node brand/make_icons.mjs`.

    python brand/make_ico.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ZRODLO = ROOT / "brand" / "icon-256.png"
CELE = [
    ROOT / "brand" / "icon.ico",
    ROOT / "desktop-agent" / "src" / "CzytnikAgent" / "ikona.ico",
    ROOT / "desktop-agent" / "test-app" / "ikona.ico",
]
ROZMIARY = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

if not ZRODLO.exists():
    raise SystemExit(f"brak {ZRODLO} - najpierw: node brand/make_icons.mjs")

obraz = Image.open(ZRODLO).convert("RGBA")
for cel in CELE:
    cel.parent.mkdir(parents=True, exist_ok=True)
    obraz.save(cel, format="ICO", sizes=ROZMIARY)
    print("  ->", cel.relative_to(ROOT))
