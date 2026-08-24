# Możliwości i granice systemu

Stan na 2026-08-21 (firmware C + konfigurator + wtyczka, po Etapach 0–12).
Trzy kategorie: **zweryfikowane na sprzęcie** (najmocniejsza gwarancja),
**zweryfikowane automatycznie** (testy w CI), **granice** (czego nie robimy
i co się wtedy dzieje).

## Co robimy — zweryfikowane na sprzęcie

| Funkcja | Jak sprawdzone |
|---|---|
| plug&play klawiatura USB — działa w każdej aplikacji bez instalowania czegokolwiek | E2/E11 na sprzęcie; httpbin.org (obca strona produkcyjna) |
| skanowanie po zbliżeniu (tryb induction modułu, bez przycisku) | konfiguracja EEPROM modułu komendami UART, E4 |
| profile w czytniku: wykrywanie regex → cięcie na pola → sekwencja `{pole} TAB "tekst" ENTER` | formularze A/GS1 na sprzęcie, 10/10 skanów |
| parser GS1 w czytniku: AI 01/17/10/21, separator GS z UART, data „00" = koniec miesiąca, AIM `]d2` | skan DataMatrix FMD z ekranu → formularz wypełniony datą ISO |
| przepisywanie 1:1 kodów bez profilu + klawisz kończący | EAN-13 passthrough na sprzęcie |
| blokada duplikatów (induction ponawia odczyt co ~1 s) | trzymanie kodu przed okiem → wpis raz |
| zapis trwały konfiguracji: atomowe sloty A/B, przeżywa restart, aktualizację firmware i (incydentalnie) instalację CircuitPythona | E11 + wielokrotne flashe w trakcie prac |
| konfigurator WebSerial z dysku urządzenia (`file://`) i z pliku — zakładki, tryb testowy, import/eksport JSON | testy właściciela E7–E12 |
| dysk `CZYTNIK` (MSC read-only): konfigurator + instrukcje + formularze testowe z podkatalogiem | montowanie i zgodność bajt w bajt po każdym flashu |
| wtyczka: wypełnianie po nazwach pól na rozpoznanych stronach, w tym przechwytywanie sekwencji TAB-owej z produkcyjnego profilu czytnika | test właściciela na sprzęcie (forma C pracownika i leku) |
| watchdog 3 s, factory reset z przycisku GP2 | E11 |
| aktualizacja firmware: `rebootBootloader` → UF2, konfiguracja nietknięta | wielokrotnie w tej sesji |

## Co robimy — zweryfikowane automatycznie (CI)

- te same wektory parsowania w trzech implementacjach: CP (52 asercje),
  C (87), wtyczka (41 unit + 18 e2e w prawdziwym Chromium),
- e2e wtyczki symuluje klawiaturę jak prawdziwy HID (osobne zdarzenia Shift,
  TAB-y w serii) — regresja z pierwszego testu sprzętowego jest przykryta,
- odrzut krzyżowy ramek (kod leku nie wypełni formularza pracownika),
- oddanie stronie nierozpoznanej ramki (brak regresji wariantu A),
- build UF2 + paczka wydania w CI.

## Jakie kody obsługujemy

**Symbologie (czyta moduł GM65):** pełna lista w manualu
([GM65-manual.pdf](GM65-manual.pdf)); **przetestowane przez nas fizycznie**:
EAN-13, QR (ramki tekstowe), DataMatrix ECC200 (GS1 z separatorem GS, skan
z ekranu i z wydruku).

**Formaty logiczne (warstwa profili):**

| Format | Wsparcie | Uwagi |
|---|---|---|
| dowolny tekst ASCII | ✔ passthrough / `parse.regexGroups` | drukowalne znaki; ramka do ~6 KB |
| ramki z separatorami (`PRC;…`, `EMP;…`) | ✔ zweryfikowane | regex z grupami w czytniku albo cięcie we wtyczce |
| GS1: AI **01** (GTIN-14), **17** (data, dzień 00→koniec miesiąca), **10** (partia ≤20), **21** (serial ≤20) | ✔ zweryfikowane (format FMD/apteczny) | kolejność AI dowolna, GS obsługiwany, AIM `]d2` zdejmowany |
| GS1: pozostałe AI (`30`, `11`, `15`, `240`, `710–714`…) | ✖ świadomie | obecność takiego AI = błąd parsowania → zachowanie wg `onError` (surowy 1:1 albo pomiń); wtyczka odrzuca ramkę (fail-safe) — patrz [ROADMAP.md](ROADMAP.md) |
| rosyjskie kody kryptograficzne (AI 91–93) | ✖ | inny ekosystem; jak wyżej — bezpieczny fallback |
| niemiecki PPN (IFA, koperta `[)>…06…`) | ✖ | nie-GS1; nie łapie się na wykrywanie → passthrough |

## Czego nie robimy (granice twarde) i co się wtedy dzieje

| Granica | Dlaczego | Zachowanie systemu |
|---|---|---|
| znaki spoza ASCII (polskie diakrytyki) w wyjściu HID | układ klawiatury US, kody kreskowe są ASCII | znaki niedrukowalne/nie-ASCII filtrowane |
| separator GS przez klawiaturę | HID przenosi tylko drukowalne | granice pól wyznacza sekwencja profilu czytnika |
| kod z nieznanym AI / niesparsowany przez profil | parser nie zgaduje granic pól | wg konfiguracji: surowy 1:1 **albo** pomiń; wtyczka odrzuca i oddaje stronie z dymkiem „Nierozpoznany kod" — **nigdy nie wpisze w złe pola** |
| wypełnianie po nazwach w aplikacjach desktopowych | wtyczka żyje w przeglądarce | wariant A (TAB-y) działa wszędzie |
| zamknięty Shadow DOM, pola `password` | brak dostępu selektorów / celowo | wtyczka pomija; hasła nigdy nie są wypełniane |
| konfigurator poza Chrome/Edge | WebSerial tylko Chromium | konfiguracja z innego stanowiska; praca czytnika bez zmian |
| stanowiska z blokadą pamięci USB (polityki firmowe) | MSC może być zablokowane | klawiatura i CDC działają; konfigurator/instrukcje z paczki wydania |
| wtyczka na `file://` bez zgody | wymóg Chrome | jednorazowo „Zezwalaj na dostęp do adresów URL plików" |

## Limity parametryczne (wariant C)

| Parametr | Limit |
|---|---|
| profile / pola / akcje na profil | 6 / 8 / 16 |
| rozmiar konfiguracji (JSON) | 4 KB |
| linia protokołu CDC | 6 KB |
| obraz dysku `CZYTNIK` | 256 KB (wolne ~130 KB) |
| wzorce regex | podzbiór: `^ $ . [] * + ? ()` + `\d \w \s`; bez `{m,n}` i `\|` |
| ramka wtyczki | separator TAB lub znak; bez prefiksu wymagana dokładna liczba segmentów |

## Znane różnice wariantu C względem prototypu CP

- event trybu testowego nie zwraca nazwy profilu i pól (tylko surowe dane),
- wersja firmware w repo to `0.0.0-dev` (wstrzykiwanie z VERSION.md — patrz ROADMAP),
- VID/PID deweloperskie `0xCAFE` — przed sprzedażą wymagany legalny.
