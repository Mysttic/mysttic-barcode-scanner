# Architektura i szczegóły techniczne

## Sprzęt

- płytka **RP2040** z natywnym USB (Raspberry Pi Pico lub klon, np. YD-RP2040),
- moduł skanera **GM65/GM805** (UART TTL 3,3 V, zasilanie 5 V), połączony:
  `TXD→GP1`, `RXD→GP0`, `VCC→VBUS`, `GND→GND`,
- opcjonalnie: LED statusu (GP6), przycisk serwisowy/factory-reset (GP2), buzzer
  (moduł ma własny). Rozszerzony schemat prototypu: [hardware/wokwi](../hardware/wokwi/README.md).

## Dwa warianty firmware

| | CircuitPython (`firmware-circuitpython/`) | C / Pico SDK + TinyUSB (`firmware-pico-sdk/`) |
|---|---|---|
| rola | prototypowanie, szybkie poprawki | **produkcja** |
| USB | HID + 2×CDC (konsola + dane) + dysk CIRCUITPY | HID + 1×CDC, bez dysku |
| zapis konfiguracji | NVM (nagłówek + CRC), fallback do pliku `config/config.json` | **atomowe sloty A/B** w ostatnich 2 sektorach flasha (magic+seq+CRC16) |
| niezawodność | brak watchdoga, pliki edytowalne przez użytkownika | watchdog 3 s, brak plików do zepsucia |
| regex profili | `re` (ure) CircuitPythona | własny `mini_regex` (podzbiór ure + grupy, limit kroków) |

Obie wersje używają **tego samego formatu konfiguracji** i **tego samego
protokołu CDC** — konfigurator i narzędzia działają z oboma.

Uwaga: sloty C i NVM CircuitPythona leżą w tych samych końcowych sektorach
flasha — zapis w jednym wariancie unieważnia (przez CRC) zapis drugiego.

## Pipeline przetwarzania skanu

```
UART (9600 8N1) → ramkowanie (terminatory CR/LF lub timeout ciszy)
  → blokada duplikatów → profile (detekcja regex → parsowanie regexGroups/GS1)
  → lista akcji (teksty + klawisze) → kolejka HID z opóźnieniami
  → [tryb testowy: zamiast HID event JSON po CDC]
```

Surowe bajty żyją do momentu parsowania (separator GS 0x1D przechodzi
nietknięty). Zasady GS1: AI 01 (14 cyfr), 17 (YYMMDD; dzień 00 = ostatni dzień
miesiąca), 10 i 21 (zmienne ≤20, kończone GS/końcem kodu), AIM ID zdejmowany.

## Protokół konfiguracyjny (USB CDC, NDJSON)

Jedna linia = jeden obiekt JSON; odpowiedzi zawierają `ok` i echo `requestId`.
Komendy: `ping`, `getConfig`, `setConfig` (walidacja → aktywacja w RAM),
`save` (zapis trwały), `setMode` (`hid`/`test`), `factoryReset`, `reboot`,
`rebootBootloader`. W trybie `test` urządzenie wysyła eventy
`{"event":"scan", "rawBase64", "hex", "profile", "fields"}`.
Klient MUSI ustawić sygnał **DTR** — bez niego urządzenie nie wysyła danych.

## Format konfiguracji

Wersjonowany JSON (`version: 1`): sekcje `device` (opóźnienia), `scanner`
(baud, terminatory, timeout ramki, blokada duplikatów), `output` (tryb bez
profilu, prefiks/sufiks, onError) i `profiles[]`
(`detect.regex` → `parse.regexGroups|gs1` → `output[]` akcji `field/key/text`).
Wzorce regex: podzbiór bez `{m,n}` (i bez `|` w wersji C) — walidowane na
urządzeniu i w konfiguratorze. Pełny przykład:
[firmware-circuitpython/default_config.json](../firmware-circuitpython/default_config.json).

## Układ plików na urządzeniu (wariant CircuitPython)

```
konfigurator.html    narzędzie konfiguracji (można uruchamiać)
config/config.json   konfiguracja startowa (można edytować)
docs/INSTRUKCJA.md   ściąga dla inżyniera
boot.py, *.py, lib/  firmware — NIE RUSZAĆ
```

## Struktura repozytorium

| Katalog | Zawartość |
|---|---|
| `firmware-circuitpython/` | firmware CP + `tests/test_firmware.py` + diagnostyki `diag_*.py`, `setup_induction.py` |
| `firmware-pico-sdk/` | firmware C (CMake + TinyUSB) + `tests/test_host.c` |
| `configurator/` | źródła konfiguratora (vite + TS + zod → single-file HTML) |
| `tools/` | `build_release.py`, `install.ps1`, `test_e2e.py`, `device_docs/` |
| `test-vectors/` | formularze demonstracyjne + kody QR |
| `hardware/` | schematy (Wokwi), przypięte pliki instalacyjne |
| `docs/` | dokumentacja + manual skanera |

## Budowanie i wydania

- Konfigurator: `cd configurator && npm ci && npm run build` → `dist/index.html`.
- Firmware C: CMake+Ninja+ARM GCC, `PICO_SDK_PATH` → `build/barcode_reader.uf2`
  (uwaga: SDK 2.x wymaga też hostowego kompilatora dla picotool).
- Paczka: `python tools/build_release.py` → `release/barcode-reader-v<wersja>.zip`
  (wersja z [VERSION.md](../VERSION.md)).
- CI: testy na PR do `master`; paczka testowa z *Run workflow*; release
  automatycznie po merge z `develop`, tylko przy podniesionej wersji.

## Pinout i protokół modułu skanera

Manual GM65: [GM65-manual.pdf](GM65-manual.pdf). Moduł konfigurowalny kodami
(str. 9: wyjście UART, str. 12: tryb induction) oraz komendami UART
(`7E 00 …` + CRC16-XModem; zone bit 0x0000; skrypt `setup_induction.py`).
