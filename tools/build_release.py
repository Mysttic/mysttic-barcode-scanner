#!/usr/bin/env python3
"""Buduje paczke wydania czytnika kodow.

Uzycie:  python tools/build_release.py [--skip-npm]
Wynik:   release/barcode-reader-v<wersja>.zip + SHA256SUMS.txt

Zawartosc paczki:
  INSTALL.md          instrukcja instalacji i konfiguracji
  install.ps1         instalator Windows (prowizjonowanie plytki)
  flash/*.uf2         CircuitPython (przypieta wersja)
  device/             pliki na dysk CIRCUITPY (firmware + lib + konfigurator)
  SHA256SUMS.txt      sumy kontrolne
"""
import argparse
import hashlib
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIRMWARE = ROOT / "firmware-circuitpython"
UF2_DIR = ROOT / "hardware" / "downloads"
ADAFRUIT_HID = next((UF2_DIR / "extracted").glob("*/lib/adafruit_hid"), None)

DEVICE_FILES = [
    "boot.py",
    "code.py",
    "version.py",
    "keys.py",
    "scanner_uart.py",
    "parser.py",
    "parser_gs1.py",
    "profiles.py",
    "output_hid.py",
    "config_store.py",
    "protocol_cdc.py",
    "default_config.json",
]


def firmware_version() -> str:
    text = (FIRMWARE / "version.py").read_text(encoding="utf-8")
    m = re.search(r'FIRMWARE_VERSION\s*=\s*"([^"]+)"', text)
    if not m:
        sys.exit("BLAD: brak FIRMWARE_VERSION w version.py")
    return m.group(1)


def build_configurator(skip_npm: bool) -> Path:
    dist = ROOT / "configurator" / "dist" / "index.html"
    if skip_npm:
        if not dist.exists():
            sys.exit("BLAD: --skip-npm, a configurator/dist/index.html nie istnieje")
        return dist
    subprocess.run(
        "npm run build", shell=True, cwd=ROOT / "configurator", check=True
    )
    return dist


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--skip-npm", action="store_true", help="uzyj istniejacego builda konfiguratora")
    args = ap.parse_args()

    version = firmware_version()
    print(f"Wersja firmware: {version}")

    uf2 = next(UF2_DIR.glob("*.uf2"), None)
    if uf2 is None:
        sys.exit("BLAD: brak pliku .uf2 w hardware/downloads/")
    if ADAFRUIT_HID is None:
        sys.exit("BLAD: brak hardware/downloads/extracted/*/lib/adafruit_hid")

    configurator = build_configurator(args.skip_npm)

    stage = ROOT / "release" / f"barcode-reader-v{version}"
    if stage.exists():
        shutil.rmtree(stage)
    (stage / "flash").mkdir(parents=True)
    device = stage / "device"
    (device / "lib").mkdir(parents=True)

    shutil.copy2(uf2, stage / "flash" / uf2.name)
    for name in DEVICE_FILES:
        shutil.copy2(FIRMWARE / name, device / name)
    shutil.copytree(ADAFRUIT_HID, device / "lib" / "adafruit_hid")
    shutil.copy2(configurator, device / "konfigurator.html")
    shutil.copy2(ROOT / "tools" / "install.ps1", stage / "install.ps1")
    shutil.copy2(ROOT / "docs" / "INSTALL.md", stage / "INSTALL.md")

    sums = []
    for path in sorted(stage.rglob("*")):
        if path.is_file():
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            sums.append(f"{digest}  {path.relative_to(stage).as_posix()}")
    (stage / "SHA256SUMS.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")

    zip_path = ROOT / "release" / f"barcode-reader-v{version}.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(stage.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(stage.parent).as_posix())

    zip_digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (ROOT / "release" / f"barcode-reader-v{version}.zip.sha256").write_text(
        f"{zip_digest}  {zip_path.name}\n", encoding="utf-8"
    )
    print(f"OK: {zip_path} ({zip_path.stat().st_size // 1024} KB)")
    print(f"SHA-256: {zip_digest}")


if __name__ == "__main__":
    main()
