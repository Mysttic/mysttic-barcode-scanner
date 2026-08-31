#!/usr/bin/env python3
"""Buduje paczke wydania Mysttic Barcode Scanner.

Uzycie:  python tools/build_release.py [--skip-npm]
Wynik:   release/mysttic-barcode-scanner-v<wersja>.zip + SHA256SUMS.txt

Zawartosc paczki:
  GETTING-STARTED.md       montaz, instalacja i pierwszy skan
  BROWSER-EXTENSION.md     wtyczka: instrukcja, format profilu, samouczek nauki
  DESKTOP-AGENT.md         agent desktopowy
  firmware/*.uf2           PRODUKCJA (wariant C): przeciagnij na RPI-RP2 i gotowe
                           - konfigurator, instrukcje i formularze testowe sa
                             w srodku, na dysku MYSTTIC
  browser-extension/       rozszerzenie przegladarki (ladowane "bez pakowania")
  desktop-agent/           agent do aplikacji Windows + instalator (opcjonalny)
  circuitpython-prototype/ wariant deweloperski: install.ps1 + flash/ + device/
  SHA256SUMS.txt           sumy kontrolne

Dodatkowy artefakt (osobny plik obok paczki):
  demo-app-v<wersja>-win-x64.zip  przenosna aplikacja do prob z agentem
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIRMWARE = ROOT / "firmware-circuitpython"
EXTENSION = ROOT / "browser-extension"
UF2_DIR = ROOT / "hardware" / "downloads"
ADAFRUIT_HID = next((UF2_DIR / "extracted").glob("*/lib/adafruit_hid"), None)
# Produkcyjny firmware (wariant C) - budowany przez CMake/Ninja przed paczka.
UF2_C_NAZWA = "mysttic_barcode_scanner.uf2"
UF2_C_DEFAULT = ROOT / "firmware-pico-sdk" / "build" / UF2_C_NAZWA
# Dokumenty w korzeniu paczki: nazwa w paczce -> plik w docs/.
DOCS_IN_PACKAGE = {
    "GETTING-STARTED.md": "getting-started.md",
    "BROWSER-EXTENSION.md": "browser-extension.md",
    "DESKTOP-AGENT.md": "desktop-agent.md",
}
# Agent desktopowy (opcjonalny modul dla aplikacji Windows).
AGENT_PROJEKT = ROOT / "desktop-agent" / "src" / "CzytnikAgent" / "CzytnikAgent.csproj"
APLIKACJA_TESTOWA = ROOT / "desktop-agent" / "test-app" / "AplikacjaTestowa.csproj"
AGENT_EXE_NAZWA = "MystticBarcodeAgent.exe"
DEMO_EXE_NAZWA = "MystticDemoApp.exe"

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
    target = stage / "browser-extension"
    shutil.copytree(
        EXTENSION,
        target,
        ignore=shutil.ignore_patterns("node_modules", "tests", "package.json", "package-lock.json", ".gitkeep"),
    )
    manifest_path = target / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["version"] = version
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def publikuj_dotnet(projekt: Path, cel: Path) -> None:
    """Buduje samodzielny plik .exe - u klienta nie trzeba instalowac .NET.

    EnableWindowsTargeting pozwala zlozyc aplikacje WinForms/WPF takze na
    Linuksie (tam powstaje paczka wydania w CI); na Windowsie nic nie zmienia."""
    subprocess.run(
        [
            "dotnet", "publish", str(projekt),
            "-c", "Release", "-r", "win-x64",
            "--self-contained", "true",
            "-p:PublishSingleFile=true",
            "-p:IncludeNativeLibrariesForSelfExtract=true",
            "-p:EnableCompressionInSingleFile=true",
            "-p:EnableWindowsTargeting=true",
            "-p:DebugType=none",
            "-o", str(cel), "--nologo", "-v", "q",
        ],
        check=True,
    )


def copy_agent(stage: Path, version: str, gotowy_exe: Path | None = None) -> None:
    """Agent desktopowy: samodzielny exe + instalator + przykladowy profil.

    W CI paczke sklada Linux, a agent jest aplikacja Windows - wtedy exe
    przychodzi gotowy z osobnego joba (--agent-exe)."""
    target = stage / "desktop-agent"
    target.mkdir(parents=True)
    if gotowy_exe is not None:
        shutil.copy2(gotowy_exe, target / AGENT_EXE_NAZWA)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            publikuj_dotnet(AGENT_PROJEKT, Path(tmp))
            shutil.copy2(Path(tmp) / AGENT_EXE_NAZWA, target / AGENT_EXE_NAZWA)

    shutil.copy2(ROOT / "desktop-agent" / "install-agent.ps1", target / "install-agent.ps1")
    shutil.copy2(ROOT / "docs" / "desktop-agent.md", target / "DESKTOP-AGENT.md")

    # profil przykladowy: ten sam, ktorym testujemy agenta
    profil = json.loads((ROOT / "desktop-agent" / "test-app" / "profile" / "profile-testowe.json")
                        .read_text(encoding="utf-8"))
    profil["Profile"][0]["Nazwa"] = "Karta pracownika (przyklad)"
    (target / "example-profile.json").write_text(
        json.dumps(profil, ensure_ascii=False, indent=2), encoding="utf-8")

    (target / "README.txt").write_text(
        "Mysttic Barcode Scanner - desktop agent (optional module)\r\n"
        f"version {version}\r\n\r\n"
        "Fills forms in Windows applications with data from a scan.\r\n"
        "Without it the scanner still works as a plain keyboard.\r\n\r\n"
        "INSTALL\r\n"
        "  Right-click install-agent.ps1 -> Run with PowerShell\r\n"
        "  (installs into your user profile and starts with Windows)\r\n\r\n"
        "RUN WITHOUT INSTALLING\r\n"
        f"  Run {AGENT_EXE_NAZWA} - an icon appears in the system tray.\r\n\r\n"
        "TEACH A FORM\r\n"
        "  Open the application window and press Ctrl+Alt+F9.\r\n\r\n"
        "Full manual: DESKTOP-AGENT.md\r\n"
        "Note: the agent's user interface is in Polish.\r\n",
        encoding="utf-8")


def buduj_aplikacje_testowa(version: str, gotowy_exe: Path | None = None) -> Path:
    """Przenosna aplikacja demonstracyjna - osobny plik zip obok paczki."""
    katalog = ROOT / "release" / f"demo-app-v{version}"
    if katalog.exists():
        shutil.rmtree(katalog)
    katalog.mkdir(parents=True)

    if gotowy_exe is not None:
        shutil.copy2(gotowy_exe, katalog / DEMO_EXE_NAZWA)
    else:
        with tempfile.TemporaryDirectory() as tmp:
            publikuj_dotnet(APLIKACJA_TESTOWA, Path(tmp))
            shutil.copy2(Path(tmp) / DEMO_EXE_NAZWA, katalog / DEMO_EXE_NAZWA)

    shutil.copy2(ROOT / "desktop-agent" / "test-app" / "profile" / "profile-testowe.json",
                 katalog / "agent-profile.json")
    (katalog / "README.txt").write_text(
        "Mysttic Barcode Scanner - demo application for the desktop agent\r\n"
        f"version {version}\r\n\r\n"
        f"Portable: needs neither an installer nor .NET. Run {DEMO_EXE_NAZWA}.\r\n\r\n"
        "Two screens: a login form and an employee card. The fields are\r\n"
        "deliberately in a different order than the data in the code, and there\r\n"
        "are decoy fields plus a combo box with suggestions. The panel at the\r\n"
        "bottom shows what the application REALLY received.\r\n\r\n"
        "Sample code to scan:  PRC;JAN;KOWALSKI;12345;IT;Specjalista\r\n\r\n"
        "Ready-made profile for the agent: agent-profile.json\r\n"
        "  (copy it to %APPDATA%\\MystticBarcodeScanner\\profile.json, or teach\r\n"
        "   your own with Ctrl+Alt+F9)\r\n"
        f"Kiosk mode for experiments:  {DEMO_EXE_NAZWA} --kiosk\r\n\r\n"
        "Note: the application's user interface is in Polish.\r\n",
        encoding="utf-8")

    zip_path = ROOT / "release" / f"demo-app-v{version}-win-x64.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(katalog.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(katalog.parent).as_posix())
    return zip_path


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
    ap.add_argument("--bez-agenta", action="store_true",
                    help="pomin agenta desktopowego i aplikacje demo (szybszy build lokalny)")
    ap.add_argument("--agent-exe", type=Path,
                    help=f"gotowy {AGENT_EXE_NAZWA} (gdy paczke sklada inny system niz Windows)")
    ap.add_argument("--app-testowa-exe", type=Path,
                    help=f"gotowy {DEMO_EXE_NAZWA}")
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

    stage = ROOT / "release" / f"mysttic-barcode-scanner-v{version}"
    if stage.exists():
        shutil.rmtree(stage)

    # --- wariant PRODUKCYJNY (C): jeden plik, cala reszta jest w srodku -------
    (stage / "firmware").mkdir(parents=True)
    shutil.copy2(args.uf2_c, stage / "firmware" / UF2_C_NAZWA)

    # --- wariant prototypowy (CircuitPython) ---------------------------------
    proto = stage / "circuitpython-prototype"
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
    shutil.copy2(configurator, device / "configurator.html")
    # struktura na urzadzeniu: config/ (edytowalne) + docs/ (dla inzyniera)
    (device / "config").mkdir()
    shutil.copy2(FIRMWARE / "default_config.json", device / "config" / "config.json")
    (device / "docs").mkdir()
    shutil.copy2(ROOT / "tools" / "device_docs" / "MANUAL.md", device / "docs" / "MANUAL.md")
    shutil.copy2(ROOT / "tools" / "install.ps1", proto / "install.ps1")

    # --- wspolne: konfigurator luzem, dokumentacja, wtyczka ------------------
    shutil.copy2(configurator, stage / "configurator.html")
    for nazwa, plik in DOCS_IN_PACKAGE.items():
        shutil.copy2(ROOT / "docs" / plik, stage / nazwa)
    shutil.copy2(ROOT / "LICENSE", stage / "LICENSE")
    shutil.copy2(ROOT / "NOTICE", stage / "NOTICE")
    shutil.copy2(ROOT / "docs" / "THIRD-PARTY-NOTICES.md", stage / "THIRD-PARTY-NOTICES.md")
    copy_extension(stage, version)

    zip_aplikacji = None
    if args.bez_agenta:
        print("Pomijam agenta desktopowego (--bez-agenta)")
    else:
        print("Agent desktopowy...")
        copy_agent(stage, version, args.agent_exe)
        print("Przenosna aplikacja demo...")
        zip_aplikacji = buduj_aplikacje_testowa(version, args.app_testowa_exe)

    sums = []
    for path in sorted(stage.rglob("*")):
        if path.is_file():
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            sums.append(f"{digest}  {path.relative_to(stage).as_posix()}")
    (stage / "SHA256SUMS.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")

    zip_path = ROOT / "release" / f"mysttic-barcode-scanner-v{version}.zip"
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for path in sorted(stage.rglob("*")):
            if path.is_file():
                zf.write(path, path.relative_to(stage.parent).as_posix())

    zip_digest = hashlib.sha256(zip_path.read_bytes()).hexdigest()
    (ROOT / "release" / f"mysttic-barcode-scanner-v{version}.zip.sha256").write_text(
        f"{zip_digest}  {zip_path.name}\n", encoding="utf-8"
    )
    print(f"OK: {zip_path} ({zip_path.stat().st_size // 1024} KB)")
    print(f"SHA-256: {zip_digest}")

    if zip_aplikacji is not None:
        digest = hashlib.sha256(zip_aplikacji.read_bytes()).hexdigest()
        zip_aplikacji.with_suffix(".zip.sha256").write_text(
            f"{digest}  {zip_aplikacji.name}\n", encoding="utf-8")
        print(f"OK: {zip_aplikacji} ({zip_aplikacji.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
