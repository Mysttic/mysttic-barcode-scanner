#!/usr/bin/env python3
"""Scenariusz testow e2e czytnika (produkcyjny/akceptacyjny).

Uzycie:  python tools/test_e2e.py            (wymaga: pip install pyserial)
Dziala z oboma wariantami firmware (CircuitPython i C) - port wykrywany
automatycznie przez ping. Kroki automatyczne + kroki operatora (skanowanie).
Konczy sie raportem PASS/FAIL i odpowiednim kodem wyjscia.
"""
import json
import sys
import time

try:
    import serial
    import serial.tools.list_ports
except ImportError:
    sys.exit("Zainstaluj pyserial:  python -m pip install pyserial")

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

RESULTS = []


def record(name, ok, info=""):
    RESULTS.append((name, ok, info))
    print(f"  [{'PASS' if ok else 'FAIL'}] {name}" + (f" — {info}" if info else ""))


class Link:
    def __init__(self, port):
        self.s = serial.Serial(port, 115200, timeout=0.4)
        self.s.dtr = True
        self.s.rts = True
        self.buf = b""
        self.port = port
        self.rid = 100

    def close(self):
        try:
            self.s.close()
        except serial.SerialException:
            pass

    def talk(self, cmd, extra=None, timeout=5):
        self.rid += 1
        req = {"cmd": cmd, "requestId": self.rid}
        if extra:
            req.update(extra)
        self.s.write((json.dumps(req) + "\n").encode())
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                d = self.s.read(4096)
            except serial.SerialException:
                return None
            if d:
                self.buf += d
                while b"\n" in self.buf:
                    line, _, self.buf = self.buf.partition(b"\n")
                    if line.strip():
                        try:
                            o = json.loads(line)
                        except ValueError:
                            continue
                        if o.get("requestId") == self.rid:
                            return o
        return None

    def wait_event(self, name, timeout):
        t0 = time.time()
        while time.time() - t0 < timeout:
            try:
                d = self.s.read(4096)
            except serial.SerialException:
                return None
            if d:
                self.buf += d
                while b"\n" in self.buf:
                    line, _, self.buf = self.buf.partition(b"\n")
                    if line.strip():
                        try:
                            o = json.loads(line)
                        except ValueError:
                            continue
                        if o.get("event") == name:
                            return o
        return None


def find_device():
    for p in serial.tools.list_ports.comports():
        if not p.vid:
            continue
        try:
            link = Link(p.device)
        except serial.SerialException:
            continue
        r = link.talk("ping", timeout=2)
        if r and r.get("pong"):
            return link, r
        link.close()
    return None, None


def reconnect(port, retries=20):
    for _ in range(retries):
        try:
            link = Link(port)
            r = link.talk("ping", timeout=2)
            if r and r.get("pong"):
                return link
            link.close()
        except serial.SerialException:
            pass
        time.sleep(1)
    return None


def ask(prompt):
    while True:
        a = input(f"  >> {prompt} [t/n]: ").strip().lower()
        if a in ("t", "tak", "y"):
            return True
        if a in ("n", "nie"):
            return False


def main():
    print("=== Test e2e czytnika kodów ===\n")
    print("Krok 1/7: wykrywanie urządzenia...")
    link, pong = find_device()
    if not link:
        record("wykrycie urządzenia", False, "brak portu odpowiadającego na ping")
        return finish()
    record("wykrycie urządzenia", True,
           f"{link.port}, firmware {pong.get('fw')} ({pong.get('impl', 'circuitpython')})")

    print("\nKrok 2/7: odczyt konfiguracji...")
    r = link.talk("getConfig")
    ok = bool(r and r.get("ok") and isinstance(r.get("config"), dict))
    original = r["config"] if ok else None
    record("getConfig", ok, f"profile: {[p['name'] for p in original.get('profiles', [])]}" if ok else "")

    print("\nKrok 3/7: setConfig (zmiana tymczasowa) i odczyt zwrotny...")
    ok = False
    if original:
        mod = json.loads(json.dumps(original))
        mod.setdefault("device", {})["keyDelayMs"] = 11
        r = link.talk("setConfig", {"config": mod})
        r2 = link.talk("getConfig")
        ok = bool(r and r.get("ok") and r2 and r2["config"]["device"]["keyDelayMs"] == 11)
    record("setConfig + odczyt zwrotny", ok)

    print("\nKrok 4/7: zapis trwały i restart (persystencja)...")
    ok = False
    if original:
        r = link.talk("save")
        if r and r.get("ok"):
            link.talk("reboot", timeout=2)
            port = link.port
            link.close()
            time.sleep(3)
            link = reconnect(port)
            if link:
                r2 = link.talk("getConfig")
                ok = bool(r2 and r2["config"]["device"]["keyDelayMs"] == 11)
    record("save + reboot + persystencja", ok)
    if not link:
        return finish()

    # przywroc oryginalna konfiguracje
    if original:
        link.talk("setConfig", {"config": original})
        link.talk("save")

    print("\nKrok 5/7: tryb testowy — zeskanuj DOWOLNY kod (30 s)...")
    link.talk("setMode", {"mode": "test"})
    ev = link.wait_event("scan", 30)
    record("tryb testowy: event skanu", ev is not None,
           f"odebrano: {ev.get('hex', '')[:24]}..." if ev else "brak skanu w 30 s")
    link.talk("setMode", {"mode": "hid"})

    print("\nKrok 6/7: tryb klawiatury — kliknij w Notatnik i zeskanuj kod.")
    record("wpis HID w Notatniku", ask("czy kod wpisał się poprawnie i zakończył Enterem?"))

    print("\nKrok 7/7: blokada duplikatów — przytrzymaj ten sam kod przed czytnikiem ~5 s.")
    record("blokada duplikatów", ask("czy kod wpisał się tylko RAZ?"))

    link.close()
    return finish()


def finish():
    print("\n=== Wynik ===")
    failed = [n for n, ok, _ in RESULTS if not ok]
    for name, ok, info in RESULTS:
        print(f"  [{'PASS' if ok else 'FAIL'}] {name}")
    print(f"\n{len(RESULTS) - len(failed)}/{len(RESULTS)} kroków zaliczonych.")
    if failed:
        print("Niezaliczone:", ", ".join(failed))
        sys.exit(1)
    print("SCENARIUSZ E2E ZALICZONY")
    sys.exit(0)


if __name__ == "__main__":
    main()
