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
| USB | HID + 2×CDC (konsola + dane) + dysk CIRCUITPY (zapisywalny) | HID + 1×CDC + **dysk `CZYTNIK` (MSC, tylko-do-odczytu)** |
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

Wtyczka do przeglądarki podpina się na końcu tego łańcucha — po stronie hosta,
nie urządzenia: na rozpoznanej stronie przechwytuje to, co „wystukuje" czytnik
(ramkę z prefiksem **albo całą sekwencję TAB-ową z profilu urządzenia** — TAB-y
są wtedy blokowane i nie ruszają fokusa), parsuje własnym silnikiem
(`browser-extension/src/parse.js`) i wstawia wartości do pól po nazwach.
Zasada pierwszeństwa: **wtyczka > wariant A na rozpoznanych stronach**; poza
nimi czytnik pisze jak zwykła klawiatura. Firmware o wtyczce nie wie i zostaje
na stałe w jednej, produkcyjnej konfiguracji. Uwaga: przez HID nie przechodzą
znaki niedrukowalne, więc separator GS 0x1D nie dociera do wtyczki — granice
pól wyznacza wtedy sekwencja z czytnika; szczegóły w [WTYCZKA.md](WTYCZKA.md).

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

## Dysk `CZYTNIK` (wariant C — MSC)

Obraz FAT12 (256 KB, z podkatalogami i LFN) generowany przy każdym buildzie
przez `tools/make_msc_image.py` z plików repo (deterministycznie, z samotestem
odczytu zwrotnego) i wbudowany w UF2 — serwowany przez TinyUSB MSC jako dysk
**tylko-do-odczytu** (zapis/format odrzucane). Konfiguracja czytnika NIE leży
na dysku (żyje w slotach flash przez CDC) — dysk to wyłącznie nośnik narzędzi:

```
CZYTAJ.TXT           szybki start (ASCII)
INSTRUKCJA.md        instrukcja urządzenia
WTYCZKA.md           instrukcja wtyczki
NAUKA-PROFILU.md     samouczek nauki profilu
konfigurator.html    konfigurator (WebSerial; bajt w bajt z configurator/dist)
testy.html           menu formularzy testowych
formularze/          5 samowystarczalnych formularzy z kodami do skanowania
```

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
| `browser-extension/` | wtyczka MV3 (bez bundlera) + testy jednostkowe i e2e |
| `tools/` | `build_release.py`, `install.ps1`, `test_e2e.py`, `device_docs/` |
| `test-vectors/` | formularze demonstracyjne + kody QR |
| `hardware/` | schematy (Wokwi), przypięte pliki instalacyjne |
| `docs/` | dokumentacja + manual skanera |

## Budowanie i wydania

- Konfigurator: `cd configurator && npm ci && npm run build` → `dist/index.html`.
- Firmware C: CMake+Ninja+ARM GCC, `PICO_SDK_PATH` → `build/barcode_reader.uf2`
  (uwaga: SDK 2.x wymaga też hostowego kompilatora dla picotool).
- Paczka: `python tools/build_release.py` → `release/barcode-reader-v<wersja>.zip`
  (wersja z [VERSION.md](../VERSION.md)). Zawiera **produkcyjny UF2 wariantu C**
  (`firmware/`, z dyskiem `CZYTNIK` w środku), **wtyczkę** (`wtyczka/`, wersja
  manifestu z VERSION.md), dokumentację i osobno wariant prototypowy
  (`prototyp-circuitpython/`). Kolejność ma znaczenie: konfigurator → firmware C
  (bo trafia do jego obrazu dysku) → paczka.
- CI: testy na PR do `master`; paczka testowa z *Run workflow*; release
  automatycznie po merge z `develop`, tylko przy podniesionej wersji.

## Testy i weryfikacja

| Poziom | Co | Ile |
|---|---|---|
| hostowe Python | framer, parser, profile, GS1, NVM, CDC (`firmware-circuitpython/tests`) | 52 asercje |
| hostowe C | te same wektory + mini_regex, config_parse, sloty, matcher (`firmware-pico-sdk/tests`) | 87 asercji |
| wtyczka unit | parsowanie delimited/regex/GS1, dopasowanie adresów, transformacje | 41 asercji |
| wtyczka e2e | prawdziwy Chromium z rozszerzeniem: ramki TAB-owe, milczenie bez profilu, odrzut krzyżowy | 18 asercji |
| sprzętowe | `tools/test_e2e.py` (CDC/persystencja/HID) + scenariusz „od pudełka" ([TESTING.md](TESTING.md), 7 testów z dysku) | — |

Wszystkie automatyczne poziomy chodzą w CI przy PR do `master`. Zasada: każda
zmiana logiki parsowania dostaje ten sam wektor we wszystkich implementacjach
(CP/C/wtyczka). Zrzuty w dokumentacji odtwarza `npm run shots` — obrazki nie
rozjeżdżają się z kodem. Macierz możliwości i zweryfikowanych formatów kodów:
[MOZLIWOSCI.md](MOZLIWOSCI.md).

## Pinout i protokół modułu skanera

Manual GM65: [GM65-manual.pdf](GM65-manual.pdf). Moduł konfigurowalny kodami
(str. 9: wyjście UART, str. 12: tryb induction) oraz komendami UART
(`7E 00 …` + CRC16-XModem; zone bit 0x0000; skrypt `setup_induction.py`).
