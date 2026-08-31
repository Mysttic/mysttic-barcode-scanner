#!/usr/bin/env python3
"""Test e2e agenta desktopowego: prawdziwa aplikacja WinForms + prawdziwe UIA.

Uruchamia aplikacje testowa, odtwarza makro dla zeskanowanej ramki i sprawdza,
czy aplikacja FAKTYCZNIE zobaczyla wartosci (panel stanu, nie same pola).

Uzycie:  python desktop-agent/tests/test_e2e.py

Domyslnie bierze lokalne buildy Release. Zeby sprawdzic pliki z GOTOWEJ paczki
wydania, wskaz je zmiennymi srodowiskowymi:
  AGENT_EXE=...\\agent-desktopowy\\MystticBarcodeAgent.exe
  APLIKACJA_EXE=...\\demo-app-v1.2.0\\MystticDemoApp.exe
  PROFIL_TESTOWY=...\\agent-desktopowy\\profil-przykladowy.json
"""
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
APLIKACJA = Path(os.environ.get("APLIKACJA_EXE")
                 or ROOT / "test-app" / "bin" / "Release" / "net9.0-windows" / "MystticDemoApp.exe")
AGENT = Path(os.environ.get("AGENT_EXE")
             or ROOT / "src" / "CzytnikAgent" / "bin" / "Release" / "net9.0-windows" / "MystticBarcodeAgent.exe")
PROFILE = Path(os.environ.get("PROFIL_TESTOWY")
               or ROOT / "test-app" / "profile" / "profile-testowe.json")

zaliczone = 0
bledy = []


def sprawdz(nazwa, warunek, szczegoly=""):
    global zaliczone
    if warunek:
        zaliczone += 1
        print(f"  [OK ] {nazwa}")
    else:
        bledy.append(f"{nazwa}{(' - ' + szczegoly) if szczegoly else ''}")
        print(f"  [FAIL] {nazwa} {szczegoly}")


def czekaj_na_log(log, fragment, sekundy=25):
    """Czeka, az agent dopisze do logu oczekiwany fragment (makro bywa wolne)."""
    koniec = time.time() + sekundy
    while time.time() < koniec:
        if log.exists():
            tresc = log.read_text(encoding="utf-8", errors="replace")
            if fragment in tresc:
                time.sleep(1.5)  # daj makru dokonczyc pozostale kroki
                return tresc
        time.sleep(0.2)
    return log.read_text(encoding="utf-8", errors="replace") if log.exists() else ""


def agent(*args, timeout=60):
    wynik = subprocess.run([str(AGENT), *args], capture_output=True, text=True,
                           encoding="utf-8", errors="replace", timeout=timeout)
    return (wynik.stdout or "") + (wynik.stderr or "")


def wyslij(*args, proby=3):
    """Symuluje skan. Windows potrafi odmowic zmiany aktywnego okna, a wtedy
    znaki poleca w inne miejsce - agent wypisuje wtedy blad, wiec powtarzamy."""
    for numer in range(proby):
        wyjscie = agent("--wyslij", *args)
        if "could not bring the window" not in wyjscie:
            return wyjscie
        time.sleep(1.0)
        print(f"  [..] okno nie przeszlo na wierzch, powtorka {numer + 1}/{proby}")
    return wyjscie


def main():
    if not APLIKACJA.exists() or not AGENT.exists():
        sys.exit("Najpierw zbuduj projekty:\n"
                 "  dotnet build -c Release desktop-agent/test-app\n"
                 "  dotnet build -c Release desktop-agent/src/CzytnikAgent")

    subprocess.run(["taskkill", "/F", "/IM", "MystticDemoApp.exe"],
                   capture_output=True, check=False)
    time.sleep(0.5)
    proces = subprocess.Popen([str(APLIKACJA)])
    time.sleep(3)

    try:
        print("\n1. Rozpoznanie okna")
        wyjscie = agent("--okno", "--proces", "MystticDemoApp")
        sprawdz("agent widzi proces aplikacji", "MystticDemoApp" in wyjscie)
        sprawdz("agent czyta tytul okna", "Employee card" in wyjscie, wyjscie.strip()[:120])

        print("\n2. UI Automation widzi pola po identyfikatorach")
        drzewo = agent("--drzewo", "--proces", "MystticDemoApp")
        for pole in ["txtFirstName", "txtLastName", "txtNumber", "cmbDepartment", "cmbPosition"]:
            sprawdz(f"kontrolka {pole} widoczna", f'id="{pole}"' in drzewo)

        print("\n3. Skan wypelnia formularz (makro z profilu)")
        wynik = agent("--symuluj", "PRC;JAN;KOWALSKI;12345;IT;Specialist",
                      "--proces", "MystticDemoApp",
                      "--profile", str(PROFILE),
                      "--sprawdz", "statePreview")
        sprawdz("profil dopasowany", "profile: Employee card" in wynik)
        sprawdz("wszystkie kroki makra udane", "steps: 5/5" in wynik,
                re.search(r"steps: \d+/\d+", wynik).group(0) if "steps:" in wynik else wynik[-200:])
        for pole, wartosc in [("firstName", "JAN"), ("lastName", "KOWALSKI"),
                              ("number", "12345"), ("department", "IT")]:
            sprawdz(f"aplikacja zobaczyla {pole}={wartosc}",
                    re.search(rf'{pole}\s*=\s*"{wartosc}"', wynik) is not None)
        sprawdz("panel stanu potwierdza komplet",
                "saw all 4 values" in wynik)
        # pole z podpowiedziami (edytowalna lista): wartosc spoza listy musi
        # trafic do aplikacji, a nie tylko wygladac na wpisana
        # wartosc jest TAKZE pozycja listy, ale profil uczono wpisywaniem -
        # agent ma wpisac tekst, nie polegac na wyborze z listy
        sprawdz("pole z podpowiedziami wypelnione trybem \"wpisz\"",
                re.search(r'position   = "Specialist"', wynik) is not None,
                next((w for w in wynik.splitlines() if "position" in w), ""))

        print("\n4. Pola-pulapki pozostaly puste")
        drzewo = agent("--drzewo", "--proces", "MystticDemoApp")
        for pole in ["txtEmail", "txtPhone"]:
            wiersz = next((w for w in drzewo.splitlines() if f'id="{pole}"' in w), "")
            sprawdz(f"{pole} nietkniete", 'value=""' in wiersz, wiersz.strip())

        print("\n5. Obcy kod nie jest wykonywany")
        wynik = agent("--symuluj", "EMP;ANNA;NOWAK;67890;HR",
                      "--proces", "MystticDemoApp",
                      "--profile", str(PROFILE))
        sprawdz("ramka spoza profilu odrzucona", "NOT PARSED" in wynik,
                wynik.strip().splitlines()[-1] if wynik.strip() else "")

        print("\n6. Profil nie dziala na innym oknie")
        wynik = agent("--symuluj", "PRC;JAN;KOWALSKI;12345;IT;Specialist",
                      "--proces", "explorer",
                      "--profile", str(PROFILE))
        sprawdz("brak profilu dla obcej aplikacji",
                "NO PROFILE" in wynik or "no window found" in wynik,
                wynik.strip().splitlines()[-1] if wynik.strip() else "")

        print("\n7. Pelna sciezka: agent w tle przechwytuje skan z klawiatury")
        # restart aplikacji, zeby pola byly puste
        proces.terminate()
        subprocess.run(["taskkill", "/F", "/IM", "MystticDemoApp.exe"], capture_output=True, check=False)
        time.sleep(1)
        proces = subprocess.Popen([str(APLIKACJA)])
        time.sleep(2.5)

        log = Path(os.environ["APPDATA"]) / "MystticBarcodeScanner" / "agent.log"
        log.unlink(missing_ok=True)
        tray = subprocess.Popen([str(AGENT), "--profile", str(PROFILE)])
        time.sleep(3.5)
        try:
            wyslij("PRC;JAN;KOWALSKI;12345;IT;Specialist", "--proces", "MystticDemoApp")
            tresc = czekaj_na_log(log, "cmbPosition")
            sprawdz("agent zobaczyl ramke ze skanu", 'frame "PRC;JAN;KOWALSKI;12345;IT;Specialist"' in tresc,
                    tresc.strip().splitlines()[-1] if tresc.strip() else "log pusty")
            sprawdz("agent wykonal makro", tresc.count("[OK]") >= 4,
                    f"[OK] w logu: {tresc.count('[OK]')}")

            drzewo = agent("--drzewo", "--proces", "MystticDemoApp")
            sprawdz("aplikacja wypelniona po przechwyconym skanie",
                    "saw all 4 values" in drzewo)
            wiersz = next((w for w in drzewo.splitlines() if 'id="txtEmail"' in w), "")
            sprawdz("znaki skanu nie wyciekly do pol aplikacji", 'value=""' in wiersz, wiersz.strip())

            print("\n8. Skan w stylu prawdziwego czytnika (Shift + wielkie litery)")
            # czytnik HID wysyla Shift przed kazda wielka litera - modyfikatory
            # nie moga przerywac ramki ani gubic wielkosci liter
            proces.terminate()
            subprocess.run(["taskkill", "/F", "/IM", "MystticDemoApp.exe"], capture_output=True, check=False)
            time.sleep(1)
            proces = subprocess.Popen([str(APLIKACJA)])
            time.sleep(3.5)
            log.unlink(missing_ok=True)
            # okno musi byc gotowe (UIA je widzi), zanim zaczniemy wysylac klawisze
            agent("--okno", "--proces", "MystticDemoApp")

            wyslij("PRC;JAN;KOWALSKI;12345;IT;Specialist", "--hid", "--proces", "MystticDemoApp")
            tresc = czekaj_na_log(log, "cmbPosition")
            sprawdz("ramka HID odczytana z zachowaniem wielkich liter",
                    'frame "PRC;JAN;KOWALSKI;12345;IT;Specialist"' in tresc,
                    tresc.strip().splitlines()[-1] if tresc.strip() else "log pusty")
            drzewo = agent("--drzewo", "--proces", "MystticDemoApp")
            sprawdz("formularz wypelniony po skanie HID",
                    "saw all 4 values" in drzewo)
        finally:
            tray.terminate()
            subprocess.run(["taskkill", "/F", "/IM", "MystticBarcodeAgent.exe"], capture_output=True, check=False)

        print("\n9. Nowy profil dziala bez restartu agenta")
        # agent startuje bez profili, plik zmienia sie w trakcie pracy
        goracy = ROOT / "test-app" / "profile" / "_test-hot.json"
        goracy.write_text(json.dumps({
            "version": 1, "lang": "en", "enabled": True,
            "settings": {"scanGapMs": 60, "minFrameLength": 3,
                         "stepPauseMs": 40, "verifyByReadback": True},
            "profiles": [],
        }), encoding="utf-8")

        proces.terminate()
        subprocess.run(["taskkill", "/F", "/IM", "MystticDemoApp.exe"], capture_output=True, check=False)
        time.sleep(1)
        proces = subprocess.Popen([str(APLIKACJA)])
        time.sleep(2.5)
        log.unlink(missing_ok=True)
        tray = subprocess.Popen([str(AGENT), "--profile", str(goracy)])
        time.sleep(3.5)
        try:
            profil = json.loads(PROFILE.read_text(encoding="utf-8"))
            profil["profiles"][0]["name"] = "Added while running"
            goracy.write_text(json.dumps(profil, ensure_ascii=False, indent=2), encoding="utf-8")
            time.sleep(2)

            tresc = log.read_text(encoding="utf-8", errors="replace") if log.exists() else ""
            sprawdz("agent zauwazyl zmiane pliku profili", "profiles reloaded" in tresc,
                    tresc.strip().splitlines()[-1] if tresc.strip() else "log pusty")

            # tak jak w kroku 8: okno musi byc gotowe, zanim polecimy klawiszami
            agent("--okno", "--proces", "MystticDemoApp")
            wyslij("PRC;ANNA;NOWAK;67890;HR;Manager", "--hid", "--proces", "MystticDemoApp")
            czekaj_na_log(log, "cmbPosition")
            drzewo = agent("--drzewo", "--proces", "MystticDemoApp")
            sprawdz("skan dziala nowym profilem bez restartu",
                    'firstName  = "ANNA"' in drzewo and 'department = "HR"' in drzewo,
                    "\n".join(w for w in drzewo.splitlines() if "=" in w and '"' in w)[:200])
        finally:
            tray.terminate()
            subprocess.run(["taskkill", "/F", "/IM", "MystticBarcodeAgent.exe"], capture_output=True, check=False)
            goracy.unlink(missing_ok=True)
    finally:
        proces.terminate()
        subprocess.run(["taskkill", "/F", "/IM", "MystticDemoApp.exe"],
                       capture_output=True, check=False)
        subprocess.run(["taskkill", "/F", "/IM", "MystticBarcodeAgent.exe"],
                       capture_output=True, check=False)

    print()
    if bledy:
        print(f"FAIL: {len(bledy)} z {zaliczone + len(bledy)} asercji")
        for blad in bledy:
            print("  - " + blad)
        return 1
    print(f"OK: {zaliczone} asercji e2e")
    return 0


if __name__ == "__main__":
    sys.exit(main())
