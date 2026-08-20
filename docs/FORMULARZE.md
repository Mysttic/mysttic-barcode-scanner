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

## Obce strony z wypełnianiem po nazwie — czego NIE zrobimy bez wtyczki

Na stronie, której kodu nie kontrolujemy, czytnik nie „widzi" nazw pól — jest
klawiaturą. Jeśli kolejność pól jest stabilna → wariant A wystarcza. Jeśli
wymagane jest celowanie po nazwach na cudzych stronach → potrzebne rozszerzenie
przeglądarki (zaplanowany, odroczony Etap 12 — wróci przy realnym wymaganiu).

## Jak uruchomić formularze demonstracyjne

Otwórz pliki `test-vectors/forma-*.html` bezpośrednio (dwuklik) albo przez
lokalny serwer: `python -m http.server 8124` w katalogu `test-vectors`
i wejdź na `http://localhost:8124/`. Przed testem włącz odpowiednie profile
w konfiguratorze ([KONFIGURACJA.md](KONFIGURACJA.md)).
