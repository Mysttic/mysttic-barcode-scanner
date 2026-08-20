# Decyzje projektowe

## 2026-08-20 — Etap 11 ZALICZONY na sprzęcie

- **Test end-to-end wersji C na urządzeniu:** enumeracja kompozytu (COM6, VID 0xCAFE) ✓; `ping` (impl:"c") ✓; `setConfig` z produkcyjnym default_config.json ✓; `save` → **konfiguracja przetrwała reboot** (sloty A/B) ✓; `hidTest` ✓; formularz A (profil regexGroups: imię TAB nazwisko TAB numer TAB dział ENTER) ✓; formularz GS1 (GTIN/data ISO/partia/serial) ✓; passthrough EAN i blokada duplikatów ✓. **Kryterium etapu spełnione: ta sama konfiguracja, te same testy, ten sam wynik co CircuitPython.**
- **Kolizja pamięci CP↔C (odnotowana):** sloty C leżą w ostatnich sektorach flasha, gdzie CircuitPython trzyma NVM — `save` w wersji C nadpisuje NVM CircuitPythona (po powrocie na CP config wróci z pliku, fallback zadziała; nagłówki są różne, więc CRC odsiewa cudze dane w obie strony).
- **TODO wersji C przed uznaniem jej za wydawalną:** eventy trybu testowego z nazwą profilu i polami, wersja z VERSION.md wstrzykiwana przy buildzie (teraz 0.0.0-dev), decyzja o MSC (konfigurator.html z paczki działa przez CDC — MSC opcjonalny), paczka release dla wariantu C.

## 2026-08-20 — Etap 11 faza 2: kompletny pipeline w C (zbudowany, do testu na sprzęcie)

- **Nowe moduły:** `mini_regex.c` — własny silnik regex z grupami przechwytującymi (podzbiór ure: `^ $ . [] * + ? ()` + klasy `\d\w\s`, opcjonalne grupy `(...)?`, backtracking z limitem kroków; `{m,n}` i `|` odrzucane w walidacji); `config_parse.c` (jsmn, vendorowany) — pełny parser+walidator configu JSON do struktur runtime, surowy JSON zachowany do getConfig/save; `config_flash.c` — **atomowe sloty A/B** w 2 ostatnich sektorach flasha (magic+seq+CRC16; zapis zawsze do przeciwnego slotu, wybór po seq — przerwany zapis nie niszczy poprzedniego); `profile_matcher.c` — detect→parse(regexGroups/gs1)→akcje + fallback passthrough/split/prefiks/sufiks/onError.
- **`main.c`:** UART0 GP0/GP1 z konfiguracji, watchdog 3 s, blokada duplikatów (okno odświeżane), LED GP6, factory reset GP2 przy starcie, tryb testowy (eventy scan z base64/hex po CDC), pending-reset po opróżnieniu kolejki HID (`watchdog_reboot`/`reset_usb_boot`).
- **Protokół CDC w C:** komplet komend zgodny z wersją CP (ping z `impl:"c"`, getConfig zwraca zachowany surowy JSON, setConfig parsuje+waliduje+aktywuje, save→flash, factoryReset→erase, reboot/rebootBootloader, hidTest diagnostycznie).
- **Testy hostowe C: 87 asercji** (framer, GS1, mini_regex na realnych wzorcach profili, config_parse na produkcyjnym default_config.json, profile_matcher end-to-end: pracownik/GS1/EAN-fallback/onError/split). UF2 111 KB.
- **Świadome różnice vs CP (do decyzji przy zamrożeniu):** event testowy nie zwraca nazwy profilu ani pól (tylko fakt dopasowania) — do uzupełnienia; brak MSC (konfigurator.html z dysku CIRCUITPY nie istnieje w wersji C — konfigurator działa przez CDC otwarty skądkolwiek); limity: 6 profili / 8 pól / 16 akcji / config 4 KB.
- **Pułapka dnia:** newlib nie podpowiada braków — `strtol`/`atoi` wymagają jawnego `<stdlib.h>` (2× ten sam błąd).

## 2026-08-20 — CI: testy jednostkowe + paczka testowa

- **`ci.yml`** (decyzja właściciela: PR do master + workflow_dispatch; push NIE odpala CI): 4 joby testowo-budowlane + paczka testowa. Testy Python skonsolidowane w `firmware-circuitpython/tests/test_firmware.py` (52 asercje, zero zależności — czysty python); testy C `firmware-pico-sdk/tests/test_host.c` z `-Werror` (23 asercje); build konfiguratora (tsc jako kontrola typów); kompilacja UF2 na ubuntu (apt gcc-arm-none-eabi + cache pico-sdk przez actions/cache).
- **Paczka testowa:** tylko na żądanie (Run workflow, np. na develop przed PR-em wydaniowym) — pełny zip wydania jako **artifact** (14 dni, bez publikacji).
- Testy hostowe utrzymywać w parze: każda zmiana logiki w wersji CP musi mieć odpowiednik w wektorach C (kryterium E11).

## 2026-08-20 — Etap 11 faza 1: toolchain + szkielet C zbudowany

- **Toolchain (Windows):** CMake + Ninja + ARM GNU Toolchain 14.2 (winget) + WinLibs GCC 16 (testy hostowe i picotool) + Pico SDK 2.x (`C:/Workspaces/pico-sdk`, submoduł tinyusb). Pułapka SDK 2.x: build wymaga TAKŻE hostowego kompilatora (picotool budowany ze źródeł) — bez niego ninja pada na „No CMAKE_C_COMPILER".
- **Szkielet `firmware-pico-sdk/`:** kompozyt USB CDC+HID na TinyUSB (deskryptory z IAD, unikalny serial z ID płytki, nazwane interfejsy, VID/PID deweloperskie 0xCAFE — przed produkcją wymagany legalny), pętla główna bez blokowania, protokół NDJSON (na razie `ping`/`hidTest`), kolejka HID z pełną mapą US.
- **Porty czystych modułów:** `scan_framer.c` (ramkowanie z terminatorami+timeout) i `parser_gs1.c` — **testy hostowe C przechodzą (23 asercje, te same wektory co testy CircuitPythona)**, zgodnie z kryterium etapu.
- **Build:** `barcode_reader.uf2` 72 KB (Release). Katalog `build/` w .gitignore.
- **Do zrobienia w kolejnych fazach E11:** UART skanera + integracja framera, port config_store (flash, sloty A/B = zapis atomowy; LittleFS odłożony — odstępstwo od litery instrukcji na rzecz prostszej atomowości), profile+regex (tiny-regex-c), pełny protokół CDC (getConfig/setConfig/...), watchdog, MSC z konfiguratorem, CI dla buildu C.

## 2026-08-20 — test na obcej stronie; decyzja o wtyczce (Etap 12)

- **Test na rzeczywistej stronie (httpbin.org/forms/post):** profil z sekwencją `{imie} " " {nazwisko} TAB {numer} TAB "email"` poprawnie wypełnił 3 pola formularza, na który nie mamy żadnego wpływu. Wniosek: **tryb sekwencji TAB działa na dowolnej stronie/aplikacji** — czytnik to klawiatura; warunkiem jest stabilna kolejność pól i kliknięcie w pole startowe.
- **Wypełnianie „po nazwach pól" na obcych stronach** wymaga kodu po stronie przeglądarki (nasza forma B działała, bo miała wbudowany skrypt nasłuchujący). Bez wtyczki się tego nie zrobi.
- **Decyzja: Etap 12 (wtyczka) ODROCZONY** — obecne potrzeby pokrywają: (a) sekwencje TAB na dowolnych stronach, (b) skrypt keyboard-wedge na stronach, które kontrolujemy. Wtyczka wróci na stół, jeśli pojawi się wymaganie: obce strony + niestabilna kolejność pól / wypełnianie po nazwach.

## 2026-08-20 — wersjonowanie przez VERSION.md

- **`VERSION.md` (root) = jedyne źródło wersji** (parsowane jako pierwszy wzorzec X.Y.Z). `firmware-circuitpython/version.py` trzyma w repo `0.0.0-dev` — przy budowaniu paczki `build_release.py` generuje `device/version.py` z wersją z VERSION.md (deploy ręczny z repo odróżnisz od wydania po „-dev").
- **`CHANGELOG.md` przeniesiony do roota** (release body w CI wskazuje nową ścieżkę).
- **Release tylko przy podniesionej wersji:** CI porównuje VERSION.md z `HEAD^1` (poprzedni master) + sprawdza istnienie taga; bez podbicia wszystkie kroki wydania są pomijane (job zielony, zero release). Wcześniejszy guard „fail przy istniejącym tagu" zastąpiony skipem — merge dokumentacyjny do mastera nie wymaga podbijania wersji.

## 2026-08-20 — Etap 10 + paczka instalacyjna + CI

- **Wersjonowanie:** `firmware-circuitpython/version.py` (semver, start 0.9.0); `ping` zwraca `fw`; konfigurator pokazuje wersję + sekcję „Aktualizacja firmware" (kroki UF2, przycisk restartu do bootloadera, link do Releases — stała `RELEASES_URL` w main.ts do podmiany po publikacji repo).
- **Paczka wydania** (`tools/build_release.py`): `INSTALL.md` + `install.ps1` + `flash/*.uf2` + `device/` (firmware, lib/adafruit_hid, konfigurator.html) + `SHA256SUMS.txt`; zip + osobny .sha256. Lokalny build: 683 KB / 25 plików.
- **Instalator Windows (`tools/install.ps1`):** wykrywa dyski po plikach-markerach (`INFO_UF2.TXT`, `boot_out.txt`) — NIE przez Get-Volume (bootloader RP2040 jest tam niewidoczny); świeża płytka = pełne prowizjonowanie, istniejąca = tylko podmiana plików (aktualizacja). **Przetestowany na żywo w obu… ścieżka aktualizacji potwierdzona na urządzeniu.**
- **CI (`.github/workflows/release.yml`):** trigger tag `v*`; pilnuje zgodności tagu z FIRMWARE_VERSION; pobiera przypięte UF2+bundle, buduje konfigurator (npm ci), składa paczkę, publikuje w GitHub Releases z changelogiem (`docs/CHANGELOG.md`). Zadziała po wypchnięciu repo na GitHuba.
- **Proces wydania (decyzja właściciela — bez ręcznych tagów):** praca na gałęzi `develop`; wydanie = **merge PR `develop` → `master`**. CI (trigger `pull_request closed` + warunek merged z develop) czyta wersję z `version.py`, sam tworzy tag `v<wersja>` i publikuje Release. Guard: jeśli wydanie o tej wersji istnieje, build się zatrzymuje z komunikatem „podbij FIRMWARE_VERSION". W PR wydaniowym: podbić `version.py` + uzupełnić `CHANGELOG.md`.
- **Dokumentacja użytkownika:** `docs/INSTALL.md` — instalacja, okablowanie, jednorazowa konfiguracja modułu skanera (Series Output/Induction), konfigurator, aktualizacja, tabela najczęstszych problemów (wyciąg z doświadczeń tej budowy).

## 2026-08-20 — Etap 8 zaliczony + rdzeń Etapu 9

- **Parser GS1 (`parser_gs1.py`):** AI 01 (GTIN, 14 cyfr), 17 (YYMMDD → pole pochodne `dataWaznosciISO`; **dzień 00 = ostatni dzień miesiąca**, z latami przestępnymi), 10 i 21 (zmienne ≤20, kończone GS 0x1D lub końcem kodu). AIM ID (`]d2` itp.) zdejmowany i dostępny jako pole `aim`. Praca na surowych bajtach; czytelne błędy (nieznany AI, urwane/niecyfrowe pole).
- **Profil typu `parse.type="gs1"`:** pola stałe (gtin/dataWaznosci/dataWaznosciISO/partia/numerSeryjny/aim) w sekwencjach akcji. Przykładowy profil `gs1-datamatrix` w default_config.json; na urządzeniu włączony przez CDC. **Test end-to-end przeszedł:** QR z separatorem GS (skan z ekranu) → formularz „Przyjęcie towaru" wypełniony, data przeliczona na ISO. GM65 przepuszcza GS 0x1D bez dodatkowej konfiguracji.
- **Etap 9 (rdzeń):** blokada duplikatów `scanner.duplicateBlockMs` (domyślnie 1500; trzymanie kodu przed okiem odświeża okno blokady — wpis leci raz), pauza po klawiszach akcji `device.actionDelayMs` (domyślnie 30), `output.prefixText`/`suffixText`, `output.onError` raw/skip przy niesparsowanym profilu. Wszystko w walidatorze, konfiguratorze (nowe pola + wybór typu parsowania z podpowiedzią pól GS1) i testach hostowych.
- **Pozostałość E9 (świadomie odłożona):** układy klawiatury PL/DE — kody kreskowe są ASCII, a US-layout pokrywa ASCII 1:1; polskie znaki diakrytyczne wymagałyby biblioteki layoutów (adafruit_circuitpython_keyboard_layouts, `keyboard_layout_win_pl`) — do dodania, gdy pojawi się realna potrzeba.
- **Pułapka procesu buildu:** `npm run build | tail && cp` — pipe maskuje exit code tsc; deploy tylko po czystym `npm run build` bez pipe.

## 2026-08-20 — Etapy 6 i 7 zaliczone (NVM + konfigurator webowy)

- **E6 — zapis trwały:** `microcontroller.nvm` (4 KB na tej płytce), format: magic `BC` + wersja + długość + CRC16-XModem + JSON; po zapisie readback i weryfikacja. Priorytet źródeł: **NVM → default_config.json → DEFAULTS**; uszkodzone NVM (zły CRC) → cichy fallback do pliku. `factoryReset` czyści NVM. Nowa komenda `reboot` (soft reset). Test end-to-end: setConfig→save→reboot→config z NVM przetrwał; factoryReset→reboot→wrócił plik. Realny config: ~600 B (dużo zapasu).
- **E7 — konfigurator:** vite + vanilla-TS + zod + vite-plugin-singlefile → **jeden plik 72,6 kB** (`configurator/dist/index.html`), wdrożony na CIRCUITPY jako `konfigurator.html`. WebSerial 115200, NDJSON z requestId (Promise per komenda), sekcje: połączenie, urządzenie, profile, test (podgląd eventów scan), zapis/import/eksport, strefa serwisowa (factory/reboot/bootloader). Profil edytowany mini-językiem sekwencji: `{pole} TAB "tekst" ENTER` (dwukierunkowa konwersja na listę akcji). Walidacja zod lustrzana wobec firmware (w tym blokada `{m,n}` w regexach). Zapis: „Zastosuj" (RAM) vs „Zapisz trwale" (NVM + weryfikacja przez ponowny getConfig).
- **Bonus — demo danych pracownika:** `test-vectors/forma-a-tab.html` (profil `pracownik-tab` w default_config.json, disabled — sekwencja imię TAB nazwisko TAB numer TAB dział ENTER, kod `PRC;…`) i `forma-b-nazwy.html` (keyboard-wedge w JS strony: ramka po prefiksie `EMP;`, wartości rozdzielane do pól po `name` niezależnie od kolejności/fokusa). QR osadzone w HTML (skan z ekranu). Wariant B = wzorzec „aplikacja współpracująca" bez wtyczki; obce strony → Etap 12.
- **Testy właściciela (2026-08-20) — PRZESZŁY:** konfigurator łączy się i zapisuje do NVM; forma A: profil `pracownik-tab` wypełnił formularz przez TAB-y i zatwierdził Enterem; forma B: strona rozdzieliła wartości po nazwach pól z ramki `EMP;…` (czytnik 1:1). Feedback UX: konfigurator zbyt techniczny dla użytkownika końcowego — do zrobienia tryb prosty (backlog).
- **UX do poprawy kiedyś:** dialog WebSerial pokazuje oba porty urządzenia (konsola + dane) bez rozróżnienia — instrukcja każe wybrać drugi (COM5); ewentualna auto-detekcja przez ping-timeout i podpowiedź.
- **Pułapka WebSerial (naprawiona):** Chrome po `port.open()` NIE ustawia DTR, a CircuitPython wysyła po CDC tylko przy DTR — bez `port.setSignals({dataTerminalReady:true})` każda komenda kończy się timeoutem. To samo dotyczyło wcześniej .NET SerialPort. Reguła projektu: każdy klient CDC musi jawnie ustawić DTR.

## 2026-08-19 — Etap 5 zaliczony (USB CDC + tryb testowy)

- **Kanał konfiguracyjny:** `usb_cdc.data` (drugi port COM, u nas COM5/MI_02), protokół NDJSON (`protocol_cdc.py`): jedna linia = jeden obiekt; odpowiedzi zawsze z `ok` + echo `requestId`; limit 8 KB/linia z kontrolowanym błędem; nieblokujący poll() w pętli głównej.
- **Komendy:** `ping`, `getConfig`, `setConfig` (walidacja → aktywacja w RAM, `persisted:false`), `save` (stub do Etapu 6), `setMode` hid/test, `factoryReset` (RAM), `rebootBootloader` (`microcontroller.on_next_reset(RunMode.UF2)` + reset po wysłaniu odpowiedzi).
- **Tryb test:** skan NIE idzie do HID; leci event `{"event":"scan","rawBase64","hex","profile","fields"}`. Zweryfikowane end-to-end pyserialem (COM5): komendy + eventy dla dwóch różnych kodów.
- **Obserwacja:** w trybie induction skaner ponawia odczyt tego samego kodu co ~1 s, gdy kod ciągle przed okiem → blokada duplikatów (Etap 9) będzie potrzebna.
- **Testy hostowe protokołu:** mock strumienia (fragmentacja, błędny JSON, nieznana komenda, wyjątek handlera, przepełnienie linii) — przechodzą.
- **Wizja produktu (doprecyzowana przez właściciela):** urządzenie plug&play jako klawiatura; profile = sekwencje typu „3 znaki → TAB → TAB → ENTER → reszta" (obecny format akcji to pokrywa); konfiguracja przez stronę `konfigurator.html` trzymaną na dysku USB urządzenia + WebSerial (RP2040 bez WiFi nie hostuje strony sieciowo); wypełnianie pól formularzy po NAZWIE wymaga rozszerzenia przeglądarki (Etap 12) — samym HID się nie da.

## 2026-08-19 — Etap 4 zaliczony (profile + walidacja) + tryb induction

- **Profile (`profiles.py`):** trzy jawne kroki — detect (regex) → parse (regexGroups → nazwane pola) → output (akcje field/key/text). Pierwszy pasujący włączony profil wygrywa; brak dopasowania → fallback passthrough/split. Test na sprzęcie: kod `P005…` cięty na pola, EAN przechodzi 1:1.
- **Walidacja (`config_store.validate`):** wersja, limit 16 KB, unikalne nazwy profili, dozwolone typy, poprawność regexów, numery grup, istnienie pól użytych w output, znane klawisze (jedno źródło prawdy: `keys.py`). Błędna konfiguracja → defaults + lista błędów na konsolę (nigdy pętla restartów). Factory reset: przycisk GP2 wciśnięty ~1 s przy starcie pomija plik konfiguracji.
- **Ograniczenie CircuitPython `re` (ure):** brak kwantyfikatorów `{m,n}` — walidator odrzuca wzorce z klamrami; rozpisywać jawnie (np. `[0-9][0-9][0-9]`).
- **Protokół komend GM65 działa z Pico:** ramka `7E 00 TYPES 01 ADDR_H ADDR_L DATA CRC16` (CRC16-XModem liczony od bajtu za 0x7E). Odczyt/zapis zone bit + save EEPROM potwierdzone. Zone bit `0x0000`: bity1-0 = tryb odczytu (00 manual / 01 command / 10 continuous / 11 sensor), bit7 LED, bit6 buzzer. Skrypt: `firmware-circuitpython/setup_induction.py`.
- **Tryb induction (sensor) ustawiony na stałe** (0xD4→0xD7 + EEPROM): skaner czyta sam po zbliżeniu kodu, bez przycisku.
- **Artefakt aplikacji:** Notepad++ z autouzupełnianiem "zjada" TAB z HID (popup przechwytuje klawisz) — testować w notepad.exe; w realnych formularzach problem nie występuje. Argument za opóźnieniem po TAB/ENTER w Etapie 9.

## 2026-08-19 — Etap 3 zaliczony (moduły + lista akcji)

- **Struktura firmware:** `code.py` (pętla główna), `scanner_uart.py` (ramkowanie surowych bajtów: terminatory z configu LUB timeout ciszy; GS 0x1D przechodzi nietknięty), `parser.py` (bajty → lista akcji; tryby `passthrough`/`split`), `output_hid.py` (akcje `{"type":"text"|"key"}` → HID; klawisze TAB/ENTER/ESC/BACKSPACE/strzałki/F1–F12; `keyDelayMs` per znak, domyślnie 10 ms), `config_store.py` (czyta `/default_config.json`, merge z defaults, przy błędzie działa na domyślnych).
- **Format akcji (wspólny dla projektu):** `[{"type":"text","value":"..."},{"type":"key","key":"TAB"}]`.
- **Testy hostowe:** logika scanner_uart/parser/config_store testowana na PC z mockiem UART (ramkowanie CR/CRLF/multi-frame/timeout/GS, split, filtry, merge configu) — przeszły wszystkie.
- **Pułapki CircuitPython:** brak `UnicodeDecodeError` (jest `UnicodeError`); pusta ramka po CRLF nie może zjadać wywołania poll().
- **Epizod sprzętowy:** serie bajtów 0x00 (break na linii TX) + chwilowe zniknięcie USB = zapady zasilania na stykach przejściówek; po dociśnięciu stabilnie. Objaw do zapamiętania.
- **Wynik:** split `P005 → TAB → 8746601261 → ENTER` potwierdzony w Notatniku; urządzenie przywrócone do `passthrough`.

## 2026-08-19 — Etap 2 zaliczony (10/10 skanów)

- **Problem 1 — skaner nie nadawał po UART:** egzemplarz miał przestawione wyjście na USB. Naprawa: zeskanowanie kodu konfiguracyjnego **„Series Output"** z manuala (`docs/GM65-manual.pdf`, str. 9, sekcja 2.1). Po tym moduł nadaje TTL 9600 8N1.
- **Problem 2 — terminator ramki:** ten GM65 kończy ramkę **samym CR (0x0D)**, bez LF. Kod z instrukcji tnie po LF — firmware przepisany: tnie po CR **lub** LF, ramkę bez terminatora domyka po 250 ms ciszy.
- **Problem 3 — odporność:** pierwszy śmieciowy bajt (0x00) zabijał firmware (`ValueError` w `layout.write`). Dodane: filtr znaków niedrukowalnych + `try/except` wokół HID.
- **Pułapka CircuitPython:** `del bytearray[:n]` nie jest wspierane (TypeError) — bufor jako `bytes` + slicing.
- **Diagnostyka w repo:** `firmware-circuitpython/diag_baud.py` (skok po prędkościach), `diag_baud2.py` (9600 vs 115200), `diag_pins.py` / `diag_findpin.py` (aktywność elektryczna pinów), `hardware/downloads/konsola.py` (nasłuch konsoli CircuitPython po COM z hosta; wymaga DTR!).
- **Wynik:** 10/10 identycznych skanów `P0058746601261` w konsoli i w Notatniku przez USB HID.

## 2026-08-19 — firmware wgrany

- **CircuitPython 10.2.1** (build `raspberry_pi_pico` — celowo generyczny, działa na klonie niezależnie od rozmiaru flasha; UID płytki DE624CB0936D1D30). Bundle bibliotek 10.x z 2026-08-18 (`adafruit_hid`). Pliki instalacyjne w `hardware/downloads/`.

## 2026-08-19 — prototyp sprzętowy i schemat

- **Piny UART (Pico):** GP0 = TX0 → RX skanera, GP1 = RX0 ← TX skanera. Zgodnie z instrukcją z Notion (Etap 1).
- **Baud rate startowy:** 9600 8N1 (domyślne GM65). Terminator ramki: CR LF.
- **Zasilanie skanera:** 5 V z pinu VBUS Pico (pin 40). GM65 komunikuje się poziomami TTL 3,3 V — **przed podłączeniem potwierdzić w karcie konkretnego modułu / pomiarem**; jeśli TX skanera ma 5 V, wstawić dzielnik 1 kΩ / 2 kΩ (GPIO RP2040 nie są 5V-tolerant).
- **Elementy opcjonalne:** LED statusu na GP6 (przez 330 Ω), przycisk TRIG na GP2 (do GND, pull-up wewnętrzny), buzzer na GP7 (docelowo przez tranzystor NPN, baza przez 1 kΩ).
- **Schemat:** `hardware/wokwi/` (diagram.json + atrapa GM65 jako custom chip). Tinkercad odrzucony — brak Pico i modułów UART w bibliotece komponentów.
- **Ograniczenie Wokwi (2026-08):** `machine.UART` na wokwi-pi-pico nie działa (hang w konstruktorze; UART0 zajęty przez konsolę REPL). Symulacja = schemat + logi atrapy w CHIPS CONSOLE; odbiór testujemy na sprzęcie.
- **Firmware docelowy:** CircuitPython + adafruit_hid (Etap 2 wg Notion), migracja do C/Pico SDK + TinyUSB dopiero po ustabilizowaniu (Etap 11).
- **Płytka — kandydat:** czarny klon Pico na RP2040 z USB-C (wygląda na YD-RP2040: BOOT/RST/USR, dioda RGB WS2812, pinout Pico). Jedyna z płytek pod ręką z natywnym USB → HID. Odrzucone: Pi Zero W (Linux, inna architektura rozwiązania), NodeMCU V3 i ESP-01S (ESP8266 — brak USB), ESP32-C3 SuperMini i ESP32-C3 OLED (C3 nie ma pełnego USB-OTG do HID).
- **Schemat zapisany w Wokwi:** https://wokwi.com/projects/472807254038722561 (płytka stykowa: zasilanie przez szyny tp/tn, elementy bierne w kolumnach 7–24; UART bezpośrednio dupontami).
- **Konwerter poziomów:** nieobecny na schemacie celowo — GM65 ma TTL 3,3 V; dzielnik 1 kΩ/2 kΩ tylko przy potwierdzonym TX 5 V (dzielnik na linii 3,3 V dałby marginalne ~2,2 V).
- **Moduł skanera (zidentyfikowany ze zdjęcia, 2026-08-19):** carrier typu GM65/GM805 — silnik skanujący na taśmie FPC, na płytce własny buzzer, przycisk wyzwalania, LED i stabilizator LDO (SOT-223) → zasilanie 5 V, logika UART 3,3 V. Złącze UART: JST, silk `GND | RXD | TXD | VCC`. **Fabryczna wiązka ma niestandardowe kolory:** żółty=GND, niebieski=RXD, fioletowy=TXD, zielony=VCC — podłączać wg opisów pinów, nie kolorów. Kontrola przed spięciem UART: multimetr na TXD→GND przy zasilonym module w spoczynku powinien pokazać ~3,3 V (linia UART w stanie jałowym = logiczna jedynka).
