# Czytnik kodów 1D/2D — instrukcja instalacji i konfiguracji

Urządzenie po instalacji działa jak zwykła klawiatura USB: podłączasz je do dowolnego
komputera, zbliżasz kod — tekst wpisuje się w aktywne okno. Profile pozwalają ciąć kody
na pola i przeplatać je klawiszami (TAB/ENTER), a konfigurację robi się stroną WWW
z pendrive'a czytnika — bez instalowania czegokolwiek.

## Co potrzebujesz

- płytka **RP2040 z natywnym USB** (Raspberry Pi Pico lub klon, np. YD-RP2040),
- moduł skanera **GM65/GM805** (UART TTL) + 4 przewody,
- kabel USB **z liniami danych**,
- komputer z Windows (instalator) oraz **Chrome lub Edge** (konfigurator),
- paczka wydania `barcode-reader-vX.Y.Z.zip` (z GitHub Releases).

## 1. Podłączenie skanera do płytki

Piny na module skanera (silk przy złączu): `GND | RXD | TXD | VCC`.

| Pin modułu | Pin płytki RP2040 |
|---|---|
| VCC | 5 V (VBUS / Vin / Vout — pin 5 V przy USB) |
| GND | GND |
| TXD | **GP1** (pin fizyczny 2) |
| RXD | **GP0** (pin fizyczny 1) |

Zasady: łącz przy odpiętym USB, najpierw masę; UART zawsze „na krzyż" (TXD→GP1, RXD→GP0).
**Nie kieruj się kolorami fabrycznej wiązki** — bywają przypadkowe; patrz na opisy pinów.
Moduł wymaga zasilania 5 V, a komunikuje się poziomem 3,3 V (bezpiecznym dla RP2040);
jeśli masz inny moduł niż GM65/GM805, potwierdź poziom TX w jego dokumentacji.

## 2. Instalacja oprogramowania

Zawartość paczki wydania:

```
firmware/barcode_reader.uf2   FIRMWARE PRODUKCYJNY — to wgrywasz
wtyczka/                      rozszerzenie przeglądarki (wariant C formularzy)
agent-desktopowy/             agent do aplikacji Windows (wariant D, opcjonalny)
konfigurator.html             kopia konfiguratora (ten sam jest w urządzeniu)
INSTALL.md, WTYCZKA.md, NAUKA-PROFILU.md, AGENT-DESKTOP.md
prototyp-circuitpython/       wariant deweloperski (opcjonalny)
SHA256SUMS.txt                sumy kontrolne
```

Obok paczki publikowany jest plik `aplikacja-testowa-v<wersja>-win-x64.zip`
— przenośna aplikacja do prób z agentem desktopowym.

**Instalacja produkcyjna (dowolny system) — jeden krok:**

1. Wejdź w tryb bootloadera: przytrzymaj **BOOT** na płytce i wciśnij **RST**
   (albo podłącz USB trzymając BOOT) — pojawi się dysk `RPI-RP2`.
2. Przeciągnij na niego **`firmware/barcode_reader.uf2`**. Płytka zrestartuje
   się sama.
3. Gotowe — czytnik zgłasza się jako klawiatura i pokazuje dysk **`CZYTNIK`**
   z konfiguratorem, instrukcjami i formularzami testowymi w środku.

Nic nie trzeba kopiować na urządzenie: konfigurator (`konfigurator.html`),
instrukcje (`INSTRUKCJA.md`, `WTYCZKA.md`, `NAUKA-PROFILU.md`) i testy
(`testy.html` + `formularze/`) są wbudowane w firmware.

**Wariant prototypowy (CircuitPython)** — tylko do prac rozwojowych, katalog
`prototyp-circuitpython/`: uruchom `install.ps1` (Windows; prawy przycisk →
*Uruchom w programie PowerShell*) albo ręcznie przeciągnij `flash/*.uf2` na
`RPI-RP2` i skopiuj zawartość `device/` na dysk `CIRCUITPY`. Różnice wariantów:
[ARCHITEKTURA.md](ARCHITEKTURA.md).

**Wtyczka do przeglądarki** (potrzebna tylko do wypełniania po nazwach pól):
`chrome://extensions` → *Tryb dewelopera* → *Załaduj rozpakowane* → katalog
`wtyczka/`. Szczegóły: [WTYCZKA.md](WTYCZKA.md).

**Agent desktopowy** (to samo, ale w aplikacjach Windows — moduł opcjonalny):
katalog `agent-desktopowy/`, kliknij prawym na `zainstaluj-agenta.ps1` →
*Uruchom w programie PowerShell*. Szczegóły: [AGENT-DESKTOP.md](AGENT-DESKTOP.md).

## 3. Konfiguracja skanera (jednorazowo, nowy moduł)

Fabrycznie moduł może mieć włączone wyjście USB zamiast UART. Jeśli po instalacji
skaner pika przy odczycie, ale nic się nie wpisuje:

1. Otwórz manual GM65 (`docs/GM65-manual.pdf` w repo, str. 9) i zeskanuj kod
   **„Series Output"**, a dla pewności też **„9600bps (Default)"**.
2. Tryb pracy bez przycisku (odczyt po zbliżeniu kodu): zeskanuj kod
   **„Induction Mode"** (str. 12) — albo podłącz czytnik i uruchom na płytce
   skrypt `setup_induction.py` z repo (ustawia tryb komendami i zapisuje w EEPROM
   skanera na stałe).

## 4. Pierwszy test

Otwórz Notatnik, kliknij w niego i zeskanuj dowolny kod EAN — powinien wpisać się
tekst + ENTER. Dziesięć skanów tego samego kodu = dziesięć identycznych linii.

Po instalacji na dysku czytnika (**`CZYTNIK`**, tylko-do-odczytu) znajdziesz:
`konfigurator.html`, `testy.html` + `formularze/` (komplet testów),
`INSTRUKCJA.md`, `WTYCZKA.md`, `NAUKA-PROFILU.md`. W wariancie prototypowym
(dysk `CIRCUITPY`) dodatkowo `config/config.json` (można edytować) i pliki
firmware `*.py`, `lib/` (nie ruszać).

## 5. Konfigurator (profile)

1. Otwórz plik **`konfigurator.html`** z dysku czytnika w Chrome/Edge
   (firmware produkcyjny C: dysk **`CZYTNIK`**, tylko-do-odczytu;
   prototyp CircuitPython: dysk `CIRCUITPY`).
2. Kliknij **Połącz** i wybierz **drugi** port „Urządzenie szeregowe USB"
   (pierwszy to konsola diagnostyczna — jeśli trafisz źle, dostaniesz timeout;
   rozłącz i wybierz drugi).
3. Zakładka **Urządzenie**: opóźnienia klawiszy, pauza po TAB/ENTER (dla wolnych
   aplikacji), blokada duplikatów, prefiks/sufiks.
4. Zakładka **Profile** — serce urządzenia. Profil = wykrywanie (regex) +
   parsowanie (regex z grupami albo **GS1**) + sekwencja akcji, np.:
   `{imie} TAB TAB ENTER {nazwisko}` albo `{gtin} TAB {dataWaznosciISO} ENTER`.
   Kody niepasujące do żadnego profilu przepisują się 1:1.
5. Zakładka **Test** (tryb testowy): skany pokazują się na stronie (surowo +
   rozbite na pola), nic nie wpisuje się do okien — idealne do strojenia profili.
6. **Zastosuj (RAM)** = do pierwszego odłączenia; **Zapisz trwale (NVM)** =
   na stałe w pamięci płytki. Oba przyciski są przy pasku zakładek.

Zrzuty ekranu wszystkich zakładek z opisami: [KONFIGURACJA.md](KONFIGURACJA.md).

Uwaga: wzorce regex działają na urządzeniu w okrojonym silniku — kwantyfikatory
`{m,n}` są niedozwolone (konfigurator to wychwyci); rozpisuj jawnie, np. `[0-9][0-9]`.

## 6. Aktualizacja firmware

1. Pobierz nową paczkę wydania i sprawdź sumę SHA-256 (`SHA256SUMS.txt`).
2. W konfiguratorze: zakładka **Aktualizacja** → **Restart do bootloadera**
   (albo ręcznie BOOT+RST).
3. Postępuj jak przy instalacji (instalator wykryje istniejący `CIRCUITPY`
   i podmieni tylko pliki; UF2 wgrywaj tylko, gdy wydanie tego wymaga).

Konfiguracja użytkownika przechowywana jest w NVM płytki i **przeżywa aktualizację**.
Przywracanie fabrycznych: przycisk w konfiguratorze albo przytrzymanie przycisku
na GP2 ~1 s przy podłączaniu USB.

## Najczęstsze problemy

| Objaw | Przyczyna / rozwiązanie |
|---|---|
| skaner pika, nic się nie wpisuje | wyjście modułu ustawione na USB → zeskanuj „Series Output" (pkt 3); albo TXD/RXD nie „na krzyż" |
| krzaczki / pojedyncze `\x00` | zła prędkość — zeskanuj „9600bps (Default)" |
| wpisuje podwójnie | trzymasz kod przed okiem — blokada duplikatów w konfiguratorze (domyślnie 1,5 s) |
| aplikacja gubi znaki / TAB nie działa | zwiększ „Opóźnienie klawiszy" i „Pauzę po TAB/ENTER"; uwaga: pola z autouzupełnianiem (np. Notepad++) mogą połykać TAB |
| konfigurator: timeout po połączeniu | wybrany pierwszy port (konsola) — rozłącz i wybierz drugi |
| urządzenie w pętli błędu po edycji configu | niemożliwe przy poprawnym firmware (walidacja + fallback), ale zawsze działa factory reset przyciskiem GP2 przy starcie |
