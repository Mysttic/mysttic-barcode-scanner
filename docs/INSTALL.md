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

## 2. Instalacja oprogramowania (Windows)

1. Rozpakuj paczkę wydania.
2. Uruchom **`install.ps1`** (prawy przycisk → *Uruchom w programie PowerShell*).
3. Rób, co mówi instalator: przytrzymaj **BOOT** na płytce i wciśnij **RST** —
   instalator sam wgra CircuitPython, poczeka na dysk `CIRCUITPY` i skopiuje
   firmware + konfigurator.
4. Po komunikacie **GOTOWE** odłącz i podłącz USB.

Instalacja ręczna (dowolny system): wejdź w tryb bootloadera (BOOT+RST), przeciągnij
`flash/*.uf2` na dysk `RPI-RP2`, poczekaj na dysk `CIRCUITPY`, skopiuj na niego całą
zawartość katalogu `device/`, odłącz i podłącz USB.

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

Po instalacji na pendrivie czytnika znajdziesz: `konfigurator.html` (narzędzie
konfiguracji), `config/config.json` (konfiguracja startowa — można edytować),
`docs/INSTRUKCJA.md` (ściąga dla inżyniera) oraz pliki firmware (`*.py`, `lib/`
— nie ruszać).

## 5. Konfigurator (profile)

1. Otwórz plik **`konfigurator.html`** z dysku `CIRCUITPY` w Chrome/Edge.
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
