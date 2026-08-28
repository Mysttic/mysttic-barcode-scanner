# Dalsze kroki (roadmapa)

Stan wyjściowy (2026-08-21): produkt działa end-to-end na sprzęcie —
firmware C z dyskiem `CZYTNIK`, konfigurator, wtyczka z nauką profili,
komplet testów. Poniżej praca uporządkowana wg priorytetu; szczegółowe
uzasadnienia decyzji w [decisions.md](decisions.md).

## 1. Domknięcie wydania 1.0 (najbliższe)

- [ ] **Przejście pełnego scenariusza „od pudełka"** przez właściciela
  ([TESTING.md](TESTING.md), sekcja 0) + `tools/test_e2e.py` — formalne
  kryterium akceptacji.
- [ ] **Wersja firmware C z VERSION.md** wstrzykiwana przy buildzie
  (dziś `0.0.0-dev` w `ping` i konfiguratorze).
- [x] ~~**Paczka wydania**: UF2 wariantu C + `wtyczka/` + instrukcje~~ —
  zrobione 2026-08-21: paczka ma `firmware/barcode_reader.uf2` (produkcja),
  `wtyczka/` z wersją z VERSION.md, komplet dokumentacji i osobno
  `prototyp-circuitpython/`; CI kompiluje firmware C przed budową paczki.
- [x] ~~**Wydanie 1.0**~~ — opublikowane 2026-08-24 (tag `v1.0.0`, PR #7).
  Paczka pobrana i zweryfikowana: suma SHA-256 zgodna, 40/40 plików zgodnych
  z `SHA256SUMS.txt`, wersja 1.0.0 w firmware i manifeście wtyczki, dysk
  `CZYTNIK` wewnątrz UF2 zawiera komplet 11 plików zgodnych z repo.
- [ ] **Eventy trybu testowego w C** z nazwą profilu i polami (parytet z CP —
  ostatnia znana różnica).

## 2. Odporność na formaty kodów

- [ ] **Rozszerzenie tabeli AI parsera GS1** o typowe dodatki spotykane na
  opakowaniach: `11` (data produkcji), `15` (najlepiej spożyć), `30` (ilość),
  `240`, `710–714` (numery krajowe) — w trzech implementacjach naraz
  (CP/C/wtyczka) + wspólne wektory testowe. Efekt: obecność nieużywanego AI
  przestaje wywracać parsowanie.
- [ ] Zebrać **realne kody z docelowych hurtowni/aptek** i przepuścić przez
  zakładkę Test konfiguratora (macierz zgodności przed wdrożeniem).
- Poza zakresem do osobnej decyzji: PPN (Niemcy), kody kryptograficzne 91–93
  (Rosja) — inne ekosystemy, dziś bezpieczny fallback
  ([MOZLIWOSCI.md](MOZLIWOSCI.md)).

## 3. Produktyzacja sprzętu (Etap 13 z instrukcji)

- [ ] PCB zamiast płytki stykowej (moduł + RP2040 + złącze JST),
- [ ] obudowa (druk 3D) z okienkiem skanera i przyciskiem serwisowym,
- [ ] **legalny VID/PID** przed sprzedażą (dziś deweloperskie `0xCAFE`),
- [ ] naklejka z QR do dokumentacji/wydań na spodzie urządzenia.

## 4. Ergonomia i wdrożenia (wg potrzeb)

- [ ] tryb prosty konfiguratora (feedback z E7: „za techniczny dla użytkownika
  końcowego"),
- [ ] wdrożenie wtyczki polityką (`ExtensionInstallForcelist` + profile przez
  `storage.managed`) — dziś instalacja „Załaduj rozpakowane",
- [ ] układ klawiatury PL/DE w HID (dziś US/ASCII — wystarcza dla kodów),
- [ ] auto-wybór portu w konfiguratorze (ping-timeout zamiast ręcznego wyboru).

## 4b. Agent desktopowy (nowy moduł, prototyp gotowy)

Stan: moduł działa i jest wydawany razem z resztą produktu (34 asercje
jednostkowe + 27 e2e na żywej aplikacji, instalator, przenośna aplikacja
testowa, zrzuty w instrukcji). Szczegóły: [AGENT-DESKTOP.md](AGENT-DESKTOP.md).

- [ ] **Test z fizycznym czytnikiem** (dotąd tylko symulowany strumień klawiszy)
  oraz **przejście trybu nauki ręcznie** przez operatora.
- [ ] Test w prawdziwej aplikacji kioskowej (skrót Ctrl+Alt+F9, okno kreatora
  nad pełnym ekranem).
- [x] ~~Edytor profili w interfejsie~~ — zrobione: okno „Profile (zarządzaj)"
  (włącz/wyłącz, nazwa, proces, wzorzec tytułu, podgląd kroków, usuwanie).
- [ ] Import/eksport profili do pliku jednym kliknięciem (jak we wtyczce).
- [ ] Podniesienie uprawnień, gdy aplikacja docelowa działa jako administrator
  (manifest z `requireAdministrator` albo restart na żądanie).
- [x] ~~Instalator/autostart + wpięcie modułu w paczkę wydania~~ — zrobione
  2026-08-28: `agent-desktopowy/` w paczce (samodzielny exe + `zainstaluj-agenta.ps1`
  + przykładowy profil), przenośna aplikacja testowa jako osobny plik wydania,
  job `agent-desktopowy` w CI i `agent-windows` w release.
- [ ] Rozważyć wspólne źródło parserów (dziś logika GS1 jest w trzech
  implementacjach: C, JS, C# — te same wektory testowe pilnują zgodności).

## 5. Wtyczka — faza 2 (gdy wedge przestanie wystarczać)

- [ ] transport CDC zamiast nasłuchu klawiatury (dane strukturalne prosto
  z urządzenia, tryb `host` + heartbeat; wymaga zmian we firmware — świadomie
  odłożone). Dotyczy też agenta desktopowego: zniósłby potrzebę hooka
  klawiatury, który bywa blokowany politykami firmowymi, i przeniósłby
  separator GS bez obchodzenia,
- [ ] agregacja wielu skanów w jeden formularz, wiersze powtarzalne,
- [ ] publikacja w Chrome Web Store (dziś świadomie pominięta — wdrożenie
  wewnętrzne).

## Zamrożone / odrzucone (żeby nie wracać bez powodu)

- **Bookmarklet jako droga produkcyjna** — odrzucony (UX); zostaje jako
  diagnostyka (`test-vectors/bookmarklet.html`).
- **Wtyczka przez WebSerial w fazie 1** — odrzucone na rzecz wedge
  (zero zmian we firmware, brak konfliktu o port).
- **LittleFS w C** — odrzucone na rzecz atomowych slotów A/B.
- **MSC zapisywalny** — dysk celowo tylko-do-odczytu (konfiguracja żyje we
  flashu przez CDC; nie ma czego zepsuć).
