#!/usr/bin/env python3
"""Buduje paczke wydania czytnika kodow.

Uzycie:  python tools/build_release.py [--skip-npm]
Wynik:   release/barcode-reader-v<wersja>.zip + SHA256SUMS.txt

Zawartosc paczki:
  INSTALL.md              instrukcja instalacji i konfiguracji
  WTYCZKA.md              instrukcja wtyczki
  NAUKA-PROFILU.md        samouczek nauki profilu
  firmware/*.uf2          PRODUKCJA (wariant C): przeciagnij na RPI-RP2 i gotowe
                          - konfigurator, instrukcje i formularze testowe sa
                            w srodku, na dysku CZYTNIK
  wtyczka/                rozszerzenie przegladarki (ladowane "bez pakowania")
  prototyp-circuitpython/ wariant deweloperski: install.ps1 + flash/ + device/
  SHA256SUMS.txt          sumy kontrolne
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIRMWARE = ROOT / "firmware-circuitpython"
EXTENSION = ROOT / "browser-extension"
UF2_DIR = ROOT / "hardware" / "downloads"
ADAFRUIT_HID = next((UF2_DIR / "extracted").glob("*/lib/adafruit_hid"), None)
# Produkcyjny firmware (wariant C) - budowany przez CMake/Ninja przed paczka.
UF2_C_DEFAULT = ROOT / "firmware-pico-sdk" / "build" / "barcode_reader.uf2"
# Dokumenty kopiowane do korzenia paczki (obok INSTALL.md).
DOCS_IN_PACKAGE = ["WTYCZKA.md", "NAUKA-PROFILU.md"]

DEVICE_FILES = [
    "boot.py",
    "code.py",
    "keys.py",
    "scanner_uart.py",
    "parser.py",
    "parser_gs1.py",
    "profiles.py",
    "output_hid.py",
    "config_store.py",
    "protocol_cdc.py",
]


def firmware_version() -> str:
    """Wersja wydania z VERSION.md (pierwszy wzorzec X.Y.Z w pliku)."""
    text = (ROOT / "VERSION.md").read_text(encoding="utf-8")
    m = re.search(r"\b(\d+\.\d+\.\d+)\b", text)
    if not m:
        sys.exit("BLAD: brak wersji X.Y.Z w VERSION.md")
    return m.group(1)


def copy_extension(stage: Path, version: str) -> None:
    """Rozszerzenie przegladarki + wersja manifestu z VERSION.md.

    Do paczki ida tylko pliki uruchomieniowe - bez testow i zaleznosci dev."""
    target = stage / "wtyczka"
    shutil.copytree(
        EXTENSION,
        target,
        ignore=shutil.ignore_patterns("node_modules", "tests", "package.json", "package-lock.json", ".gitkeep"),
    )
    manifest_path = target / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["version"] = version
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


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
    ap.add_argument("--uf2-c", type=Path, default=UF2_C_DEFAULT,
                    help="UF2 produkcyjnego firmware C (domyslnie firmware-pico-sdk/build/)")
    args = ap.parse_args()

    version = firmware_version()
    print(f"Wersja firmware: {version}")

    uf2 = next(UF2_DIR.glob("*.uf2"), None)
    if uf2 is None:
        sys.exit("BLAD: brak pliku .uf2 w hardware/downloads/")
    if ADAFRUIT_HID is None:
        sys.exit("BLAD: brak hardware/downloads/extracted/*/lib/adafruit_hid")
    if not args.uf2_c.is_file():
        sys.exit(
            f"BLAD: brak produkcyjnego firmware C ({args.uf2_c}).\n"
            "      Zbuduj go najpierw:  cmake -G Ninja -B build && ninja -C build\n"
            "      (w firmware-pico-sdk/, z PICO_SDK_PATH) albo wskaz plik przez --uf2-c."
        )

    configurator = build_configurator(args.skip_npm)

    stage = ROOT / "release" / f"barcode-reader-v{version}"
    if stage.exists():
        shutil.rmtree(stage)

    # --- wariant PRODUKCYJNY (C): jeden plik, cala reszta jest w srodku -------
    (stage / "firmware").mkdir(parents=True)
    shutil.copy2(args.uf2_c, stage / "firmware" / "barcode_reader.uf2")

    # --- wariant prototypowy (CircuitPython) ---------------------------------
    proto = stage / "prototyp-circuitpython"
    (proto / "flash").mkdir(parents=True)
    device = proto / "device"
    (device / "lib").mkdir(parents=True)

    shutil.copy2(uf2, proto / "flash" / uf2.name)
    for name in DEVICE_FILES:
        shutil.copy2(FIRMWARE / name, device / name)
    (device / "version.py").write_text(
        "# Plik generowany przez tools/build_release.py z VERSION.md.\n"
        f'FIRMWARE_VERSION = "{version}"\n',
        encoding="utf-8",
    )
    shutil.copytree(ADAFRUIT_HID, device / "lib" / "adafruit_hid")
    shutil.copy2(configurator, device / "konfigurator.html")
    # struktura na urzadzeniu: config/ (edytowalne) + docs/ (dla inzyniera)
    (device / "config").mkdir()
    shutil.copy2(FIRMWARE / "default_config.json", device / "config" / "config.json")
    (device / "docs").mkdir()
    shutil.copy2(ROOT / "tools" / "device_docs" / "INSTRUKCJA.md", device / "docs" / "INSTRUKCJA.md")
    shutil.copy2(ROOT / "tools" / "install.ps1", proto / "install.ps1")

    # --- wspolne: konfigurator luzem, dokumentacja, wtyczka ------------------
    shutil.copy2(configurator, stage / "konfigurator.html")
    shutil.copy2(ROOT / "docs" / "INSTALL.md", stage / "INSTALL.md")
    for doc in DOCS_IN_PACKAGE:
        shutil.copy2(ROOT / "docs" / doc, stage / doc)
    copy_extension(stage, version)

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
