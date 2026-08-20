#!/usr/bin/env python3
"""Testy hostowe firmware CircuitPython (bez sprzetu, bez zaleznosci).

Uruchomienie:  python tests/test_firmware.py   (z katalogu firmware-circuitpython)
Moduly czyste (scanner_uart, parser, profiles, parser_gs1, config_store,
protocol_cdc) importuja sie na zwyklym Pythonie - importy CircuitPythonowe
(board/busio/usb_*) sa tylko w code.py i output_hid.py, ktorych tu nie ruszamy.
"""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config_store as cs
import parser as p
import parser_gs1 as g
import profiles as pf
from keys import KEY_NAMES, KEY_TO_KEYCODE_ATTR
from protocol_cdc import MAX_LINE_BYTES, CdcProtocol
from scanner_uart import ScannerUart

cs.CONFIG_PATH = str(Path(__file__).resolve().parent.parent / "default_config.json")

CHECKS = 0


def check(cond, msg):
    global CHECKS
    CHECKS += 1
    if not cond:
        raise AssertionError(msg)


class MockUart:
    def __init__(self, chunks):
        self.chunks = list(chunks)

    def read(self, n):
        return self.chunks.pop(0) if self.chunks else None


def test_scanner_uart():
    s = ScannerUart(MockUart([b"P00587", b"46601261\r", None]), terminators=(0x0D, 0x0A))
    got = [f for f in (s.poll() for _ in range(3)) if f]
    check(got == [b"P0058746601261"], "ramkowanie CR")

    s = ScannerUart(MockUart([b"AAA\r\nBBB\r\n"]), terminators=(0x0D, 0x0A))
    check((s.poll(), s.poll()) == (b"AAA", b"BBB"), "dwie ramki CRLF w jednym odczycie")

    s = ScannerUart(MockUart([b"XYZ", None, None]), terminators=(0x0D,), frame_timeout=0.05)
    check(s.poll() is None, "przed timeoutem brak ramki")
    time.sleep(0.08)
    check(s.poll() == b"XYZ", "timeout ciszy domyka ramke")

    s = ScannerUart(MockUart([b"01123\x1d21ABC\r"]), terminators=(0x0D,))
    check(b"\x1d" in s.poll(), "separator GS przechodzi surowo")


def test_parser_fallback():
    cfg = {"output": {"mode": "passthrough", "suffixKey": "ENTER"}}
    a = p.build_actions(b"P0058746601261", cfg)
    check(a == [{"type": "text", "value": "P0058746601261"}, {"type": "key", "key": "ENTER"}], "passthrough")

    cfg = {"output": {"mode": "split", "splitAt": 4, "suffixKey": "ENTER"}}
    a = p.build_actions(b"ABCD1234", cfg)
    check(
        a == [
            {"type": "text", "value": "ABCD"},
            {"type": "key", "key": "TAB"},
            {"type": "text", "value": "1234"},
            {"type": "key", "key": "ENTER"},
        ],
        "split: pole1 TAB pole2 ENTER",
    )

    check(p.build_actions(b"\xff\xfe", cfg) == [], "nie-ASCII odrzucone")
    a = p.build_actions(b"AB\x1dCD", {"output": {"mode": "passthrough", "suffixKey": "ENTER"}})
    check(a[0]["value"] == "ABCD", "znaki niedrukowalne filtrowane")

    cfg = {"output": {"mode": "passthrough", "suffixKey": "ENTER", "prefixText": ">>", "suffixText": "<<"}}
    vals = [x.get("key", x.get("value")) for x in p.build_actions(b"ABC", cfg)]
    check(vals == [">>", "ABC", "<<", "ENTER"], "prefix/suffix tekstowy")


def load_config():
    return cs._merge(cs.DEFAULTS, json.loads(Path(cs.CONFIG_PATH).read_text(encoding="utf-8")))


def test_validation():
    merged = load_config()
    check(cs.validate(merged) == [], "default_config przechodzi walidacje")

    bad = json.loads(json.dumps(merged))
    bad["profiles"].append(
        {
            "name": bad["profiles"][0]["name"],
            "enabled": True,
            "detect": {"type": "regex", "pattern": "^[0-9]{14}$"},
            "parse": {"type": "regexGroups", "fields": {"x": 0}},
            "output": [{"type": "field", "name": "brak"}, {"type": "key", "key": "SUPER"}],
        }
    )
    joined = " | ".join(cs.validate(bad))
    for frag in ("zdublowana", "{m,n}", "grupy >= 1", "nie istnieje w parse.fields", "nieznany klawisz"):
        check(frag in joined, "walidacja wykrywa: " + frag)


def test_profiles_regex():
    demo = load_config()
    prac = next(x for x in demo["profiles"] if x["name"] == "pracownik-tab")
    prac["enabled"] = True
    profile, fields, err = pf.match_profile("PRC;JAN;KOWALSKI;12345;IT", demo)
    check(profile is not None and not err, "profil pracownik-tab dopasowany")
    check(fields == {"imie": "JAN", "nazwisko": "KOWALSKI", "numer": "12345", "dzial": "IT"}, "pola regexGroups")
    acts = pf.build_output_actions(profile, fields)
    vals = [x.get("key", x.get("value")) for x in acts]
    check(vals == ["JAN", "TAB", "KOWALSKI", "TAB", "12345", "TAB", "IT", "ENTER"], "akcje z profilu")
    profile, _, _ = pf.match_profile("EMP;ANNA;NOWAK;1;HR", demo)
    check(profile is None, "kod EMP nie pasuje (selektywnosc)")


def test_gs1():
    GS = b"\x1d"
    raw = b"]d2" + b"0105901234567890" + b"17260831" + b"10LOT123" + GS + b"21SER0001"
    fields, aim, err = g.parse(raw)
    check(err is None and aim == "]d2", "wektor z instrukcji: AIM")
    check(fields["gtin"] == "05901234567890" and fields["dataWaznosciISO"] == "2026-08-31", "GTIN + data ISO")
    check(fields["partia"] == "LOT123" and fields["numerSeryjny"] == "SER0001", "pola zmienne")

    f2, aim2, err2 = g.parse(b"21SN42" + GS + b"0105901234123457" + b"10ABC")
    check(err2 is None and aim2 is None and f2["numerSeryjny"] == "SN42", "inna kolejnosc AI")

    check(g.date_to_iso("260200") == "2026-02-28", "dzien 00 -> koniec miesiaca")
    check(g.date_to_iso("280200") == "2028-02-29", "luty przestepny")
    check(g.date_to_iso("261100") == "2026-11-30", "listopad")

    for bad, frag in [
        (b"9912345", "nieobslugiwany AI"),
        (b"010590123412345", "oczekiwano 14"),
        (b"01059012341234AB", "samych cyfr"),
        (b"10" + b"X" * 21, "za dlugie"),
    ]:
        ff, _, ee = g.parse(bad)
        check(ff is None and frag in ee, "blad GS1: " + frag)

    demo = load_config()
    gs1p = next(x for x in demo["profiles"] if x["name"] == "gs1-datamatrix")
    gs1p["enabled"] = True
    acts = p.build_actions(b"0105901234123457" + b"17270630" + b"10P77" + GS + b"21S001", demo)
    vals = [x.get("key", x.get("value")) for x in acts]
    check(vals == ["05901234123457", "TAB", "2027-06-30", "TAB", "P77", "TAB", "S001", "ENTER"], "profil gs1 e2e")

    bad_raw = b"0105901234123457" + b"99XX"
    demo["output"]["onError"] = "raw"
    check(p.build_actions(bad_raw, demo)[0]["value"].startswith("0105901234123457"), "onError=raw")
    demo["output"]["onError"] = "skip"
    check(p.build_actions(bad_raw, demo) == [], "onError=skip")


def test_nvm():
    nvm = bytearray(4096)
    cfg = json.loads(json.dumps(cs.DEFAULTS))
    cfg["device"]["keyDelayMs"] = 25
    check(cs.save_to_nvm(cfg, nvm) is None, "zapis NVM")
    check(cs.load_from_nvm(nvm)["device"]["keyDelayMs"] == 25, "odczyt NVM")

    loaded, msgs = cs.load(nvm=nvm)
    check(loaded["device"]["keyDelayMs"] == 25 and any("zrodlo=NVM" in m for m in msgs), "priorytet NVM")

    nvm[10] ^= 0xFF
    check(cs.load_from_nvm(nvm) is None, "korupcja CRC odrzucona")
    loaded, msgs = cs.load(nvm=nvm)
    check(any("zrodlo=plik" in m for m in msgs), "fallback do pliku")

    cs.save_to_nvm(cfg, nvm)
    cs.clear_nvm(nvm)
    check(cs.load_from_nvm(nvm) is None, "clear NVM")

    big = json.loads(json.dumps(cs.DEFAULTS))
    big["pad"] = "X" * 5000
    err = cs.save_to_nvm(big, nvm)
    check(err is not None and "za duza" in err, "limit rozmiaru NVM")

    real = load_config()
    check(cs.save_to_nvm(real, bytearray(4096)) is None, "realny config miesci sie w 4KB")


class MockStream:
    def __init__(self):
        self.rx = b""
        self.tx = []

    @property
    def in_waiting(self):
        return len(self.rx)

    def read(self, n):
        d, self.rx = self.rx[:n], self.rx[n:]
        return d

    def write(self, b):
        self.tx.append(b)

    def replies(self):
        return [json.loads(x.decode().strip()) for x in self.tx]


def test_protocol_cdc():
    ms = MockStream()
    proto = CdcProtocol(
        ms,
        {
            "ping": lambda req: {"pong": True},
            "boom": lambda req: (_ for _ in ()).throw(RuntimeError("awaria")),
            "echo": lambda req: {"got": req.get("x")},
        },
    )

    def drain():
        while ms.rx:
            proto.poll()
        proto.poll()

    ms.feed = lambda s: setattr(ms, "rx", ms.rx + s)

    ms.feed(b'{"cmd":"ping","requestId":7}\n')
    drain()
    check(ms.replies()[-1] == {"ok": True, "pong": True, "requestId": 7}, "ping + requestId")

    ms.feed(b'{"cmd":"nope","requestId":1}\nto nie json\n[1,2]\n')
    drain()
    rs = ms.replies()
    check(rs[-3]["ok"] is False and "nieznana" in rs[-3]["error"], "nieznana komenda")
    check(rs[-2]["ok"] is False and "JSON" in rs[-2]["error"], "bledny JSON")
    check(rs[-1]["ok"] is False and "obiekt" in rs[-1]["error"], "nie-obiekt")

    ms.feed(b'{"cmd":"boom","requestId":9}\n')
    drain()
    r = ms.replies()[-1]
    check(r["ok"] is False and "awaria" in r["error"] and r["requestId"] == 9, "wyjatek handlera")

    ms.feed(b'{"cmd":"ec')
    drain()
    ms.feed(b'ho","x":42}\n')
    drain()
    check(ms.replies()[-1] == {"ok": True, "got": 42}, "fragmentacja linii")

    ms.feed(b'{"cmd":"ping","pad":"' + b"A" * MAX_LINE_BYTES + b'"}\n')
    drain()
    check("przekracza" in ms.replies()[-1]["error"], "limit dlugosci wiadomosci")
    ms.feed(b'{"cmd":"ping"}\n')
    drain()
    check(ms.replies()[-1]["pong"] is True, "protokol zyje po przepelnieniu")


def test_keys_consistency():
    check(len(KEY_NAMES) == 20 and "F12" in KEY_NAMES, "lista klawiszy kompletna")
    check(KEY_TO_KEYCODE_ATTR["ESC"] == "ESCAPE" and KEY_TO_KEYCODE_ATTR["UP"] == "UP_ARROW", "mapowanie nazw")


def main():
    tests = [
        test_scanner_uart,
        test_parser_fallback,
        test_validation,
        test_profiles_regex,
        test_gs1,
        test_nvm,
        test_protocol_cdc,
        test_keys_consistency,
    ]
    for t in tests:
        t()
        print(f"{t.__name__}: OK")
    print(f"WSZYSTKIE TESTY PRZESZLY ({CHECKS} asercji)")


if __name__ == "__main__":
    main()
