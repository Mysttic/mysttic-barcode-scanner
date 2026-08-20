# Czytnik kodów 1D/2D — programowalna klawiatura USB

Urządzenie typu *plug&play*: podłączasz do dowolnego komputera przez USB, zbliżasz kod
kreskowy lub QR — odczyt wpisuje się w aktywne okno jak z klawiatury. Żadnych sterowników
ani aplikacji po stronie komputera.

Siłą projektu są **profile**: czytnik sam rozpoznaje typ kodu (wyrażeniem regularnym albo
parserem GS1), tnie go na pola i wpisuje je w zadanej sekwencji z klawiszami specjalnymi,
np. `{imie} TAB {nazwisko} TAB {numer} ENTER` — idealne do wypełniania formularzy.

**Sprzęt:** płytka RP2040 (Raspberry Pi Pico lub klon) + moduł skanera GM65/GM805 (UART).
**Firmware:** CircuitPython (docelowo migracja do C/TinyUSB).

## Możliwości

- klawiatura USB HID — działa wszędzie, bez instalacji,
- skanowanie automatyczne po zbliżeniu kodu (tryb *induction*, bez przycisku),
- profile: detekcja (regex) → parsowanie (grupy regex lub **GS1**: GTIN, data ważności
  z przeliczeniem na ISO, partia, numer seryjny) → sekwencja akcji (pola, teksty,
  TAB/ENTER/ESC/strzałki/F1–F12),
- blokada duplikatów, konfigurowalne opóźnienia klawiszy, prefiks/sufiks,
- **konfigurator WWW na pendrivie czytnika** (`konfigurator.html` + WebSerial) —
  edycja profili, podgląd skanów na żywo (tryb testowy), zapis trwały w pamięci płytki,
- konfiguracja odporna na błędy: walidacja + ustawienia fabryczne przyciskiem,
- aktualizacje przez UF2, paczki wydań budowane automatycznie w CI.

## Schemat połączeń (minimum)

![Schemat połączeń: RP2040 + GM65](docs/img/schemat-minimalny.svg)

| Pin modułu skanera | Przewód (nasza wiązka) | Pin płytki RP2040 | Uwagi |
|---|---|---|---|
| VCC | zielony | 5 V (VBUS, pin 40) | moduł wymaga 5 V |
| GND | czerwony | GND (pin 3) | wspólna masa — podłącz jako pierwszą |
| TXD | żółty | **GP1** (pin 2) | UART „na krzyż" |
| RXD | czarny | **GP0** (pin 1) | UART „na krzyż" |

Połączenia wykonuj przy odpiętym USB. Kolory w tabeli i na schemacie odpowiadają naszej
wiązce — przy innych przewodach kieruj się **opisami pinów na module**, nie kolorami. Rozszerzony wariant prototypu (LED statusu, przycisk, buzzer na płytce
stykowej) znajdziesz w [hardware/wokwi](hardware/wokwi/README.md).

## Szybki start

1. Pobierz paczkę `barcode-reader-vX.Y.Z.zip` z [Releases](../../releases).
2. Podłącz skaner do płytki wg schematu powyżej.
3. Uruchom `install.ps1` z paczki i postępuj wg komunikatów (BOOT+RST na płytce).
4. Otwórz `konfigurator.html` z dysku `CIRCUITPY` w Chrome/Edge → **Połącz**.

Pełna instrukcja (w tym jednorazowa konfiguracja modułu skanera i rozwiązywanie
problemów): **[docs/INSTALL.md](docs/INSTALL.md)**.

## Struktura repozytorium

| Katalog | Zawartość |
|---|---|
| `firmware-circuitpython/` | firmware urządzenia + narzędzia diagnostyczne (`diag_*.py`, `setup_induction.py`) |
| `configurator/` | źródła konfiguratora WWW (vite + TS + zod → jeden plik HTML) |
| `tools/` | budowanie paczki wydania (`build_release.py`) i instalator (`install.ps1`) |
| `test-vectors/` | formularze demonstracyjne + kody QR do testów |
| `hardware/` | schemat prototypu (Wokwi), przypięte pliki instalacyjne CircuitPython |
| `docs/` | [INSTALL](docs/INSTALL.md) · [decyzje projektowe](docs/decisions.md) · manual skanera |

## Rozwój i wydania

Praca odbywa się na gałęzi `develop`. Wydanie = PR `develop` → `master`:
w PR podbij wersję w [VERSION.md](VERSION.md) i uzupełnij [CHANGELOG.md](CHANGELOG.md) —
po merge CI zbuduje paczkę i opublikuje ją w Releases automatycznie.
Merge **bez podniesienia wersji** nie tworzy wydania (CI kończy się czystym pominięciem).

CI uruchamia się przy **utworzeniu PR do `master`**: testy hostowe firmware
(Python, 52 asercje), testy modułów C (23 asercje), build konfiguratora (kontrola
typów) i kompilacja firmware C do UF2. **Przed** zrobieniem PR-a wydaniowego
możesz ręcznie odpalić ten sam workflow przyciskiem *Run workflow* (zakładka
*Actions*, gałąź `develop`) — zbuduje dodatkowo **paczkę testową**: kompletny
zip wydania jako artifact, bez publikowania czegokolwiek.
