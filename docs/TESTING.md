# Testowanie

Cztery poziomy: scenariusz „od pudełka" (ręczny, z dysku czytnika), testy
jednostkowe (automatyczne), scenariusz e2e na sprzęcie (półautomatyczny)
i plan testów akceptacyjnych (checklista przed wdrożeniem).

## 0. Scenariusz „od pudełka" — pełny test z dysku czytnika

Wszystko, czego potrzeba, jest w czytniku. Konfiguracja urządzenia przez cały
scenariusz jest JEDNA (produkcyjna) — niczego nie przełączasz między testami.

**Przygotowanie (raz):**

1. Podłącz czytnik do USB — pojawi się dysk **`CZYTNIK`**.
2. Otwórz z dysku `konfigurator.html` (Chrome/Edge) → **Połącz** → zakładka
   **Profile**: włączone mają być `pracownik-tab` i `gs1-datamatrix`
   (stan fabryczny wydania; jeśli nie — zaznacz i **Zapisz trwale**) → Rozłącz.
3. Zainstaluj wtyczkę: `chrome://extensions` → **Tryb dewelopera** →
   **Załaduj rozpakowane** → katalog `browser-extension/` z repozytorium lub
   paczki wydania. W **Szczegóły** wtyczki włącz **„Zezwalaj na dostęp do
   adresów URL plików"** (strony testowe otwierają się z dysku).
4. Otwórz z dysku **`testy.html`** — to menu całego scenariusza.

**Testy (kolejno, kody skanujesz prosto z ekranu):**

| # | Test | Kroki | Oczekiwany wynik |
|---|---|---|---|
| 1 | **A — TAB-y** | otwórz formularz A, kliknij pole „Imię", zeskanuj | pola wypełnione PO KOLEI (JAN/KOWALSKI/12345/IT), Enter zatwierdza |
| 2 | **B — pola po nazwie** | otwórz formularz B, nic nie klikaj, zeskanuj | wartości trafiają po nazwach mimo pomieszanej kolejności; pułapki puste |
| 3 | **GS1 — TAB-y** | otwórz formularz GS1, kliknij pierwsze pole, zeskanuj | GTIN, data `RRRR-MM-DD`, partia, numer seryjny po kolei |
| 4 | **C — karta pracownika (wtyczka)** | otwórz, sprawdź dymek „Czytnik: Karta pracownika (demo)" i badge `ON`, zeskanuj BEZ klikania | te same dane co w teście 1, ale pola są pomieszane i wypełniają się PO NAZWACH; panel „stan strony" pokazuje 4/4 |
| 5 | **C — negatywny** | na stronie testu 4 przełącz na widok *Ustawienia*, kliknij w pole, zeskanuj | badge gaśnie, TAB-y działają jak zwykła klawiatura (bez wtyczki) |
| 6 | **C — zamówienie leku** | otwórz, sprawdź dymek „Czytnik: Zamówienie leku (demo)", zeskanuj DataMatrix | numer seryjny `K7L9XW24MQ1R`, data `2027-10-31` (z `271000` — dzień 00 = koniec miesiąca), GTIN, seria — po nazwach; pułapki puste |
| 7 | **przełączanie profili** | wróć na stronę testu 4 i zeskanuj kod LEKU | nic się nie wypełnia (ramka odrzucona) — profile nie strzelają na krzyż |

Kryterium zaliczenia: 1–7 zgodne z tabelą. Dalej (opcjonalnie): tryb nauki
na obcej stronie z poligonu ([FORMULARZE.md](FORMULARZE.md), sekcja „Poligon")
— procedura w [WTYCZKA.md](WTYCZKA.md).

## 1. Testy jednostkowe (bez sprzętu)

Uruchamiają się automatycznie w CI przy każdym PR do `master`
(`.github/workflows/ci.yml`). Lokalnie:

```bash
cd firmware-circuitpython && python tests/test_firmware.py
```

```bash
cd firmware-pico-sdk && gcc -Wall -Wextra -Werror -I src tests/test_host.c src/scan_framer.c src/parser_gs1.c src/mini_regex.c src/config_parse.c src/profile_matcher.c -o test_host && ./test_host
```

```bash
cd browser-extension && npm ci && npm test
```

Zakres: ramkowanie UART, parser i profile (regex + GS1), walidacja konfiguracji,
zapis NVM, protokół CDC — te same wektory w wersji Python i C; dla wtyczki
dodatkowo dopasowanie adresów i transformacje wartości.

### Test e2e wtyczki (Chromium, bez sprzętu)

```bash
cd browser-extension && npm run test:e2e      # na serwerze: xvfb-run -a npm run test:e2e
```

Startuje prawdziwy Chromium z załadowanym rozszerzeniem, otwiera
`test-vectors/forma-c-wtyczka.html` i symuluje skan zdarzeniami klawiatury.
Sprawdza, że rozpoznany formularz zostaje wypełniony **i że strona faktycznie
widzi wartości** (nie tylko `value`), że na widoku bez profilu wtyczka milczy
oraz że obcy kod zostaje oddany stronie. Chodzi też w CI przy każdym PR.

## 2. Scenariusz e2e na sprzęcie

Podłącz czytnik i uruchom:

```bash
python tools/test_e2e.py
```

Skrypt sam znajdzie urządzenie (działa z oboma wariantami firmware) i przejdzie
7 kroków: wykrycie → odczyt konfiguracji → zmiana + odczyt zwrotny → **zapis
trwały + restart + kontrola trwałości** → tryb testowy (operator skanuje kod) →
wpis przez klawiaturę do Notatnika (operator potwierdza) → blokada duplikatów
(operator potwierdza). Kończy się raportem PASS/FAIL; konfiguracja urządzenia
wraca do stanu sprzed testu.

## 3. Paczka testowa przed wydaniem

Zakładka *Actions* → workflow `ci` → **Run workflow** (gałąź `develop`) —
CI przejdzie testy i zbuduje kompletny zip wydania jako artifact (bez
publikacji). Zainstaluj go na urządzeniu testowym (`install.ps1`) i przejdź
scenariusz e2e, zanim zrobisz PR wydaniowy.

## 4. Plan testów akceptacyjnych (przed wdrożeniem produkcyjnym)

Sprzęt:
- [ ] 100 kolejnych skanów bez resetu i utraty znaków
- [ ] odłączenie/podłączenie USB nie wymaga żadnej konfiguracji
- [ ] konfiguracja nieuszkodzona po nagłym odłączeniu zasilania (także w trakcie „Zapisz trwale")
- [ ] stabilna praca z docelowym przewodem USB

Parsowanie i klawiatura:
- [ ] kod prosty przepisany 1:1; profile tną poprawnie pola puste/długie
- [ ] TAB/ENTER działają w aplikacji docelowej (dobrane pauzy)
- [ ] błędny kod nie zawiesza urządzenia (onError wg konfiguracji)
- [ ] blokada duplikatów przy trzymaniu kodu przed okiem

GS1:
- [ ] AI 01/17/10/21 w różnej kolejności, pola zmienne na końcu i przed separatorem
- [ ] separator GS (0x1D) nie ginie; data „00" przeliczana wg reguły

Wtyczka (jeśli wdrażana):
- [ ] profil włącza się na docelowym formularzu i gaśnie po wyjściu z niego
- [ ] pola-pułapki zostają puste; formularz zapisuje się z kompletem danych
- [ ] na stronie bez profilu skan zachowuje się jak przed instalacją wtyczki
- [ ] tryb nauki tworzy działający profil na formularzu klienta

Konfigurator:
- [ ] połączenie w Chrome i Edge; tryb testowy nie wpisuje do okien
- [ ] błędna konfiguracja nie da się zapisać; import/eksport zachowuje profile
- [ ] ustawienia fabryczne działają (przycisk i wariant sprzętowy GP2)

## Proces wydania (przypomnienie)

`develop` → (opcjonalnie paczka testowa + e2e) → PR do `master` (CI: testy) →
merge → automatyczny release, jeśli wersja w [VERSION.md](../VERSION.md) została
podniesiona. Szczegóły: [ARCHITEKTURA.md](ARCHITEKTURA.md).
