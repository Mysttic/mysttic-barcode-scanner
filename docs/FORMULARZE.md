# Wypełnianie formularzy — wszystkie warianty

Czytnik jest klawiaturą, więc „wypełnianie formularza" to zawsze jedna z trzech
strategii. Gotowe formularze demonstracyjne do każdego wariantu są w
[test-vectors](../test-vectors/README.md) (z kodami QR do skanowania z ekranu).

## Wariant A — sekwencja tabulatorów (działa WSZĘDZIE)

**Kiedy:** dowolna strona lub aplikacja (także desktopowa), której pola mają
stabilną kolejność przeskoku TAB-em.

**Jak:** profil w czytniku tnie kod na pola i wpisuje je przeplatane TAB-ami,
np. `{imie} TAB {nazwisko} TAB {numer} TAB {dzial} ENTER`. Operator klika
w pierwsze pole i skanuje — resztę robi czytnik.

**Demo:** `test-vectors/forma-a-tab.html` (kod `PRC;JAN;KOWALSKI;12345;IT`,
profil `pracownik-tab`). Zweryfikowane też na obcej, „prawdziwej" stronie
(httpbin.org) — bez żadnych zmian po stronie strony.

**Ograniczenia:** kolejność pól musi być stała; pola z autouzupełnianiem potrafią
przechwycić TAB (np. Notepad++) — w aplikacjach docelowych zwykle nie występuje,
a pauzę po TAB można wydłużyć w konfiguracji.

## Wariant B — pola po nazwie (nasza strona, bez wtyczki)

**Kiedy:** strona, której kod HTML kontrolujemy (własny system, intranet).

**Jak:** czytnik pracuje 1:1, a strona ma mały skrypt nasłuchujący klawiatury
(keyboard-wedge): rozpoznaje ramkę po prefiksie (np. `EMP;`), po Enterze parsuje
ją i wstawia wartości do pól **po ich nazwach** — kolejność pól i fokus nie mają
znaczenia. Wzorcowy skrypt (ok. 30 linii) jest w `test-vectors/forma-b-nazwy.html`.

**Demo:** `test-vectors/forma-b-nazwy.html` (kod `EMP;ANNA;NOWAK;67890;HR`) —
celowo z pomieszaną kolejnością pól i polami-pułapkami.

## Wariant GS1 — kody towarowe (apteka, magazyn)

**Kiedy:** kody GS1 DataMatrix/QR z polami: GTIN (01), data ważności (17),
partia (10), numer seryjny (21).

**Jak:** profil z parsowaniem **GS1** — czytnik sam rozbiera kod (łącznie
z niewidocznym separatorem GS), przelicza datę na format `RRRR-MM-DD`
(dzień „00" = ostatni dzień miesiąca) i wpisuje pola sekwencją, np.
`{gtin} TAB {dataWaznosciISO} TAB {partia} TAB {numerSeryjny} ENTER`.

**Demo:** `test-vectors/forma-gs1.html`.

## Wariant C — obce strony po selektorach: wtyczka przeglądarki (Etap 12)

Na stronie, której kodu nie kontrolujemy, czytnik nie „widzi" nazw pól — jest
klawiaturą. Celowanie w pola po selektorach wymaga skryptu w przeglądarce —
robi to **wtyczka Chrome/Edge** z katalogu
[`browser-extension/`](../browser-extension/README.md).

**Jak działa:** czytnik wpisuje kod `WEB;…` 1:1 (nie łapie go żaden profil
w czytniku), wtyczka na stronie z profilem nasłuchuje klawiatury, rozpoznaje
ramkę po prefiksie, tnie po średnikach i wstawia wartości w pola po selektorach
CSS — z natywnymi zdarzeniami `input`/`change` (działa z React/Angular),
obsługą `select`ów i ponowieniem, gdy strona jeszcze się renderuje. Plakietka
📷 w rogu potwierdza aktywny profil i liczbę wypełnionych pól. Profile
(host → mapowania `selektor => szablon`) edytuje się w opcjach wtyczki,
z importem/eksportem JSON do prowizjonowania stanowisk. Instalacja i szczegóły:
[browser-extension/README.md](../browser-extension/README.md).

**Zweryfikowane automatycznie (2026-08-21, symulacja wedge):** ParaBank 7/7 pól,
DemoQA (React) 5/5, Toolshop 10/10 (w tym data ISO i select kraju), DataTables
(filtr na żywo zadziałał), AutomationExercise (trafiło w signup, login pusty).

**Wariant awaryjny bez instalacji:** ta sama logika jako bookmarklet —
[`test-vectors/bookmarklet.html`](../test-vectors/bookmarklet.html)
(przeciągnij link na pasek zakładek; klik po każdym przeładowaniu strony,
profile zaszyte w linku — do diagnostyki, nie do produkcji).

## Poligon: obce strony do testów wypełniania po polach (Etap 12)

Zweryfikowane na żywo (2026-08-20) publiczne strony treningowe do testów
procedury „profil dla strony → skan → wypełnienie po ZNALEZIENIU pól"
(wymaga wtyczki z Etapu 12; strony są przeznaczone do nauki automatyzacji,
więc można na nich bezkarnie ćwiczyć):

| Strona | Scenariusz | Pola (selektory) | Uwagi |
|---|---|---|---|
| [selenium.dev/…/web-form.html](https://www.selenium.dev/selenium/web/web-form.html) | baseline — wszystkie typy pól | `name=my-text`, `my-password`, `my-textarea`, `my-select`, `my-check`, `my-radio`, `my-date` | najprostsza i najstabilniejsza; oficjalna strona Selenium |
| [parabank.parasoft.com/…/register.htm](https://parabank.parasoft.com/parabank/register.htm) | rejestracja z pełnym adresem | `id=customer.firstName`, `customer.lastName`, `customer.address.street`, `customer.address.city`, `customer.address.state`, `customer.address.zipCode`, `customer.phoneNumber` | klasyczny HTML bez frameworka; kropki w id — selektor przez `[id="…"]` |
| [practicesoftwaretesting.com/auth/register](https://practicesoftwaretesting.com/auth/register) | sklep — rejestracja z adresem | `id=first_name`, `last_name`, `dob` (RRRR-MM-DD!), `country` (select), `postal_code`, `house_number`, `street`, `city`, `state`, `phone`, `email` | Angular; ma też `data-test`; pole daty w ISO — idealne pod `{dataWaznosciISO}` z GS1 |
| [practicesoftwaretesting.com](https://practicesoftwaretesting.com/) | sklep — wyszukiwanie + filtry | `id=search-query`, checkboxy `name=category_id` | test „wpisz w wyszukiwarkę i zatwierdź" oraz filtrów |
| [demoqa.com/automation-practice-form](https://demoqa.com/automation-practice-form) | duży formularz treningowy | `id=firstName`, `lastName`, `userEmail`, `userNumber`, `currentAddress` | React — pułapka: samo ustawienie `value` nie zadziała, wtyczka musi wysłać natywne zdarzenia `input` |
| [automationexercise.com/login](https://automationexercise.com/login) | sklep — signup (2 kroki) | krok 1: `name=name`, `name=email` (`data-qa=signup-name/-email`); pełny adres w kroku 2 | pułapka: DWA pola `name=email` na stronie (login+signup) — test celowania w kontekście formularza |
| [datatables.net/examples/basic_init/zero_configuration.html](https://datatables.net/examples/basic_init/zero_configuration.html) | filtrowanie tabeli na żywo | `id=dt-search-0` | filtr reaguje na każdy znak — weryfikuje zdarzenia `input` przy wpisywaniu |
| [httpbin.org/forms/post](https://httpbin.org/forms/post) | prosty formularz zamówienia | `name=custname`, `custtel`, `custemail` | już zweryfikowany z wariantem A (TAB-y) — dobry do porównania obu podejść |

Odpadło: demo.nopcommerce.com (kolejka oczekiwania przed wejściem),
saucedemo.com (adres dopiero po logowaniu). Do testów NIE wysyłać formularzy
na prawdziwych sklepach produkcyjnych — powyższe strony są od tego.

## Jak uruchomić formularze demonstracyjne

Otwórz pliki `test-vectors/forma-*.html` bezpośrednio (dwuklik) albo przez
lokalny serwer: `python -m http.server 8124` w katalogu `test-vectors`
i wejdź na `http://localhost:8124/`. Przed testem włącz odpowiednie profile
w konfiguratorze ([KONFIGURACJA.md](KONFIGURACJA.md)).
