# Changelog

Wszystkie istotne zmiany projektu. Wersję wydania definiuje plik [VERSION.md](VERSION.md).

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
