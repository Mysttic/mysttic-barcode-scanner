# Changelog

Wszystkie istotne zmiany projektu. Wersję wydania definiuje plik [VERSION.md](VERSION.md).

## Nieopublikowane

- **Wtyczka: dostrajanie wartości wychodzącej do formularza.** Pole profilu
  może być obiektem `{selector, format, transform}`: `format` przelicza datę na
  postać, której chce formularz, a `transform` wykonuje proste operacje
  (`gtin13`, `digits`, `upper`, `lower`, `trim`, `prefix:`, `suffix:`,
  `slice:`). Zwykły selektor działa jak dotąd.
- **Dowolny wzorzec daty i czasu:** tokeny `RRRR`/`YYYY`, `RR`/`YY`, `MM`/`M`,
  `DD`/`D`, `HH`/`H`, `MI`, `SS`/`S` — bez rozróżniania wielkości liter
  (`dd-mm-yy` działa), z tekstem w apostrofach (`'godz.'`) i regułą „`MM` po
  godzinie to minuty". Na wejściu rozpoznawane także wartości z czasem
  (`RRRR-MM-DD HH:MM`, `RRMMDDHHMM`, sam `HH:MM`). Kontrolki `date`, `time`
  i `datetime-local` dostają format, którego wymaga przeglądarka.
- Tryb nauki: przy wartości wyglądającej na datę panel potwierdzania dokłada
  przyciski z podglądem formatów oraz pole na własny wzorzec z podglądem na
  żywo — przepływ kreatora bez zmian.
- Testy wtyczki: 96 asercji jednostkowych + 22 e2e.

## 1.0.0 — 2026-08-21

Pierwsze wydanie produkcyjne. Firmware w C jest wariantem docelowym, a paczka
zawiera go jako gotowy plik do wgrania — konfigurator, instrukcje i formularze
testowe są **w środku urządzenia**.

### Firmware produkcyjny (C / Pico SDK)

- Pełny pipeline: UART → ramkowanie → blokada duplikatów → profile
  (regex z grupami / parser GS1) → sekwencje klawiszy → USB HID.
- **Dysk `CZYTNIK`** (USB MSC, tylko-do-odczytu, obraz FAT12 budowany z repo):
  `konfigurator.html`, `testy.html` + `formularze/`, `INSTRUKCJA.md`,
  `WTYCZKA.md`, `NAUKA-PROFILU.md`. Podłączasz czytnik i masz wszystko —
  bez internetu, bez instalowania czegokolwiek.
- Atomowy zapis konfiguracji (sloty A/B z CRC), watchdog 3 s, factory reset
  z przycisku, tryb testowy po CDC, restart do bootloadera komendą.
- Wersja firmware wstrzykiwana przy buildzie z `VERSION.md` (widoczna w `ping`
  i w konfiguratorze).

### Wypełnianie formularzy

- Wtyczka przechwytuje także **sekwencje TAB-owe z profilu urządzenia**:
  czytnik zostaje na stałe w jednej, produkcyjnej konfiguracji, a na
  rozpoznanych stronach wtyczka sama rozkłada dane po nazwach pól.
  Poza nimi TAB-y działają jak dotąd (brak regresji).
- Kreator nauki profilu: potwierdzanie wyboru pola, cofanie do poprzedniego
  kroku, duplikowanie i porządkowanie profili, import/eksport JSON.
- Drugie demo: zamówienie leku z prawdziwym DataMatrix GS1 (GTIN, data „00"
  = koniec miesiąca, seria, numer seryjny) i automatyczne przełączanie profili.

### Paczka wydania

- `firmware/barcode_reader.uf2` (produkcja — instalacja to jeden krok),
  `wtyczka/`, `konfigurator.html`, `INSTALL.md`, `WTYCZKA.md`,
  `NAUKA-PROFILU.md`, `prototyp-circuitpython/` (wariant deweloperski).
- CI kompiluje firmware C po zbudowaniu konfiguratora (trafia do obrazu dysku)
  i publikuje paczkę automatycznie po merge `develop` → `master`.

### Dokumentacja i testy

- Nowe: `MOZLIWOSCI.md` (co działa, co zweryfikowane, jakie kody i gdzie są
  granice), `ROADMAP.md`, `NAUKA-PROFILU.md`, scenariusz „od pudełka”
  w `TESTING.md`.
- Testy: 52 asercje (Python) + 87 (C) + 41 (wtyczka, jednostkowe)
  + 18 (wtyczka, e2e w Chromium) — wszystkie w CI.

## 0.10.0 — 2026-08-21

- **Wtyczka do przeglądarki (Etap 12, faza 1)** — rozpoznaje formularz po adresie
  i obecności pól (działa w SPA), przechwytuje skan i wypełnia pola **po nazwach**.
  Poza rozpoznanym formularzem nie robi nic: czytnik zachowuje się jak zwykła
  klawiatura, warianty A i B działają bez zmian. Firmware nietknięty.
- Tryb **Ucz formularza**: zeskanuj kod → nazwij segmenty → klikaj pola;
  profile można eksportować i rozsyłać na inne stanowiska.
- Parsowanie `delimited` / `regex` / `gs1` (port parsera GS1 z firmware'u),
  wstawianie wartości odporne na React/Vue/Angular z weryfikacją odczytem zwrotnym.
- Formularz demonstracyjny `test-vectors/forma-c-wtyczka.html` (SPA, pola
  w pomieszanej kolejności, pola-pułapki, podgląd stanu strony).
- Testy: 36 asercji jednostkowych + 10 asercji e2e w Chromium z załadowanym
  rozszerzeniem; nowy job `wtyczka` w CI.
- Paczka wydania zawiera katalog `wtyczka/` (wersja manifestu z VERSION.md)
  oraz `WTYCZKA.md`.

## 0.9.2 — 2026-08-20

- Wersjonowanie przeniesione do `VERSION.md` (jedyne źródło prawdy); `device/version.py`
  generowany przy budowaniu paczki.
- `CHANGELOG.md` przeniesiony do korzenia repozytorium.
- Release wykonuje się tylko, gdy wersja w `VERSION.md` została podniesiona
  (merge bez podbicia = brak wydania, bez błędu CI).

## 0.9.1 — 2026-08-20

- README z opisem projektu i minimalnym schematem połączeń (render Wokwi,
  kolory zgodne z wiązką urządzenia referencyjnego).
- Źródło schematu: `hardware/wokwi/diagram-minimal.json`.
- Poprawka CI: `unzip -o` przy rozpakowywaniu biblioteki (kolizja z plikami z repo).

## 0.9.0 — 2026-08-20

Pierwsze wydanie paczkowane.

- Firmware CircuitPython: UART→USB HID, profile (regex z grupami + parser GS1
  z AI 01/17/10/21 i datą ISO), blokada duplikatów, pauzy po klawiszach,
  prefiks/sufiks, onError raw/skip.
- Kanał konfiguracyjny USB CDC (NDJSON): getConfig/setConfig/save/setMode/
  factoryReset/reboot/rebootBootloader; tryb testowy z eventami skanów.
- Trwały zapis konfiguracji w NVM (CRC + weryfikacja, fallback do pliku).
- Konfigurator WWW (single-file, WebSerial) na dysku urządzenia.
- Instalator Windows (install.ps1) i paczka wydania budowana w CI.
