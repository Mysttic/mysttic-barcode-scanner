# Wtyczka do przeglądarki — wypełnianie formularzy po nazwach pól

Rozszerzenie produktu dla formularzy, na których sekwencja TAB-ów jest zbyt
krucha: pola w innej kolejności niż dane w kodzie, pola-pułapki między nimi,
strony jednostronicowe (SPA) przebudowujące formularz w locie.

## Zasada działania

Wtyczka jest **pasywna, dopóki nie rozpozna formularza**.

| Sytuacja | Co robi wtyczka | Co widzi operator |
|---|---|---|
| formularz rozpoznany | przechwytuje skan i rozkłada dane po polach **po nazwach** | badge `ON`, dymek „Wypełniono 4 pola" |
| formularz nierozpoznany | **nic** — nie dotyka klawiatury | czytnik pisze jak zwykle (TAB-y, passthrough) |

Drugi wiersz jest równie ważny jak pierwszy: poza rozpoznanymi formularzami
nie ma żadnej zmiany zachowania, więc warianty A i B z
[FORMULARZE.md](FORMULARZE.md) działają dalej bez zmian.

![Popup wtyczki na stronie z rozpoznanym formularzem](img/wtyczka-popup.png)
![Popup wtyczki na stronie bez profilu](img/wtyczka-popup-bez-profilu.png)

Kliknięcie ikony pokazuje, w którym z tych dwóch stanów jesteś: po lewej strona
z rozpoznanym profilem (na pasku dochodzi badge `ON`), po prawej strona bez
profilu — czytnik pisze wtedy jak zwykła klawiatura.

Czytnik i firmware **pozostają nietknięte** — wtyczka nie łączy się
z urządzeniem, tylko słucha klawiatury, bo czytnik *jest* klawiaturą.
Do formularza demo wystarczy konfiguracja fabryczna (passthrough + ENTER).

## Algorytm

**Przy otwarciu strony i przy każdej zmianie widoku w SPA:**

1. weź bieżący adres,
2. znajdź pierwszy włączony profil, którego wzorzec URL pasuje,
3. sprawdź, czy wymagane pola profilu faktycznie są w DOM
   (to odróżnia formularze pod tym samym adresem),
4. jest → aktywuj profil, nie ma → uśpij się.

**Przy skanie (tylko gdy profil jest aktywny):**

5. znaki lecące szybciej niż `burstGapMs` (domyślnie 60 ms) to czytnik,
   nie człowiek — trafiają do bufora ramki,
6. ENTER kończy ramkę,
7. ramka idzie do parsera zgodnie z `parse.type` profilu,
8. wartości trafiają do pól ze słownika `fields`, każde pole jest
   **weryfikowane odczytem zwrotnym**,
9. podsumowanie w dymku + podświetlenie pól (zielone/czerwone).

**Gdy ramka się nie sparsuje**, wtyczka oddaje przechwycone znaki stronie —
tak, jakby jej tam nie było. To gwarancja braku regresji.

## Instalacja

1. Chrome/Edge → `chrome://extensions` (Edge: `edge://extensions`).
2. Włącz **Tryb dewelopera**.
3. **Załaduj rozpakowane** → wskaż katalog `wtyczka/` z paczki wydania
   (albo `browser-extension/` z repozytorium).
4. Przypnij ikonę na pasku — badge `ON` pokazuje rozpoznany formularz.

Aby testować formularze z pliku (`file://`), włącz w szczegółach rozszerzenia
**Zezwalaj na dostęp do adresów URL plików**. Prościej: uruchom lokalny serwer
(`python -m http.server 8124` w katalogu `test-vectors`).

## Pierwszy test

1. Otwórz `test-vectors/forma-c-wtyczka.html` (widok *Karta pracownika*).
2. Badge powinien pokazać `ON`, a w rogu mignąć „Czytnik: Karta pracownika (demo)".

![Formularz demo przed skanem](img/wtyczka-formularz-przed.png)

3. Zeskanuj kod ze strony (`PRC;JAN;KOWALSKI;12345;IT`) — **bez klikania w pola**.
4. Cztery pola wypełniają się po nazwach, pola-pułapki zostają puste,
   a panel „stan strony" pokazuje, że strona naprawdę zobaczyła wartości.

![Formularz demo po skanie](img/wtyczka-formularz-po.png)

Zwróć uwagę na trzy rzeczy naraz: dane trafiły w pola mimo **innej kolejności
niż w kodzie**, pola-pułapki (e-mail, telefon) zostały puste, a `Dział` to
`<select>` — wtyczka dobrała opcję po wartości. Panel na dole to stan
wewnętrzny strony: gdyby wtyczka podmieniła tylko `value` bez zdarzeń,
zostałby pusty i formularz zapisałby się bez danych.

5. Przełącz na zakładkę *Ustawienia* — badge gaśnie. Kliknij w pole i zeskanuj:
   kod wpisze się surowo, jak z klawiatury.

## Dodanie własnego formularza

Otwórz formularz, dla którego chcesz zrobić profil, i kliknij ikonę wtyczki →
**Ucz formularza**. Kreator ma trzy kroki.

**Krok 1 — zeskanuj kod**, którym będziesz wypełniał ten formularz. Znaki nie
trafiają na stronę, więc formularz zostaje czysty.

![Tryb nauki, krok 1: skanowanie kodu](img/wtyczka-nauka-1-skan.png)

**Krok 2 — nazwij segmenty.** Wtyczka sama tnie kod (dobiera separator spośród
`;` `|` `,` i tabulatora) i pokazuje, co z niego wyszło. Po lewej wartości
z Twojego kodu, po prawej nazwy do wpisania. Segmenty do pominięcia — zwykle
prefiks — oznacz znakiem `_`.

![Tryb nauki, krok 2: nazywanie segmentów kodu](img/wtyczka-nauka-2-segmenty.png)

**Krok 3 — klikaj pola.** Wtyczka pyta po kolei o każdą nazwę i pokazuje, jaką
wartość ma tam wstawić. Pole pod kursorem podświetla się na zielono; kliknięcie
zapisuje selektor i przechodzi do następnej nazwy. Pola, których na tym
formularzu nie ma, pomijasz przyciskiem.

![Tryb nauki, krok 3: wskazywanie pól klikaniem](img/wtyczka-nauka-3-pola.png)

**Zapis.** Na koniec nadajesz profilowi nazwę i sprawdzasz wzorzec adresu
(podpowiadany z bieżącej strony) oraz prefiks ramki. Zielone obwódki pokazują
pola, które właśnie przypisałeś.

![Tryb nauki: zapis profilu](img/wtyczka-nauka-4-zapis.png)

Profil zapisuje się lokalnie i działa od razu. Gotowe profile można wyeksportować
do pliku (**Profile formularzy** → *Eksportuj*) i rozesłać na inne stanowiska.

## Profile formularzy

Ikona wtyczki → **Profile formularzy**: lista zapisanych profili (można je
wyłączać i usuwać) oraz cała konfiguracja jako JSON — do ręcznej edycji,
eksportu na inne stanowiska i importu.

![Lista profili i konfiguracja JSON](img/wtyczka-opcje.png)

## Format profilu

Celowo bliźniaczy do profilu w czytniku: *gdzie* → *jak rozłożyć* → *gdzie wstawić*.

```json
{
  "id": "erp-przyjecie",
  "name": "Przyjęcie towaru — ERP",
  "enabled": true,
  "match": {
    "urlPattern": "https://erp.firma.pl/magazyn/przyjecie*",
    "requiredFields": ["gtin", "partia"]
  },
  "parse": {
    "type": "delimited",
    "prefix": "PRC;",
    "separator": ";",
    "fields": ["_", "imie", "nazwisko", "numer", "dzial"]
  },
  "fields": {
    "imie": "input[name=imie]",
    "dzial": "select[name=dzial]"
  },
  "after": { "action": "none" }
}
```

| Pole | Znaczenie |
|---|---|
| `match.urlPattern` | wzorzec adresu; `*` zastępuje dowolny fragment |
| `match.requiredFields` | nazwy pól, które muszą istnieć w DOM, żeby profil się włączył |
| `parse.type` | `delimited` (segmenty), `regex` (grupy jak w urządzeniu) albo `gs1` |
| `parse.prefix` | początek ramki; dopóki pasuje, znaki nie trafiają na stronę |
| `fields` | mapa `nazwa pola → selektor CSS` |
| `after.action` | `none` (domyślnie), `focus` + `selector`, `submit` |

Typ `regex` przyjmuje `pattern` i `fields` jako mapę `nazwa → numer grupy` —
dokładnie tak jak `parse.regexGroups` w konfiguracji czytnika, więc profil
można przepisać jeden do jednego.

## Kody GS1

Firmware filtruje znaki niedrukowalne, więc **separator GS (0x1D) nie przechodzi
przez klawiaturę** — parser nie miałby jak rozpoznać granic pól zmiennej długości
(AI 10 i 21). Dwa wyjścia:

- **zalecane:** w czytniku zrób profil GS1, który wypisuje pola rozdzielone
  widocznym znakiem (akcje `field` przeplatane `text "|"`), a we wtyczce użyj
  `parse.type: "delimited"`;
- albo ustaw `parse.gsChar` na znak, którym rozdzielone są pola w kodzie.

Sam parser GS1 (AI 01/17/10/21, data „00" = ostatni dzień miesiąca, zdejmowanie
AIM ID) jest we wtyczce portem tego z firmware'u i przechodzi te same wektory testowe.

## Ustawienia

W **Profile formularzy** → JSON, sekcja `settings`:

| Klucz | Domyślnie | Znaczenie |
|---|---|---|
| `burstGapMs` | 60 | maksymalna przerwa między znakami uznawana jeszcze za skan |
| `minFrameLength` | 3 | krótsze ramki są ignorowane |
| `highlight` | `true` | podświetlanie wypełnionych pól |

## Ograniczenia i bezpieczeństwo

- Wtyczka **nie wychodzi do sieci** — nie ma uprawnień sieciowych, wszystko
  (profile, skany) zostaje lokalnie w przeglądarce.
- Pól typu `password` nie wypełnia nigdy.
- Zamknięty Shadow DOM jest nieosiągalny dla selektorów — takie pola trzeba
  wypełnić wariantem A (TAB-y).
- Pola z podpowiedziami (typeahead), które wymagają wyboru z listy, mogą
  wymagać ręcznego zatwierdzenia — wartość zostanie wpisana, ale wybór z listy
  należy do strony.
- Fokus musi być w oknie przeglądarki: gdy operator kliknie poza nią, skan
  trafi tam, gdzie jest kursor — jak zwykła klawiatura.

## Testy

```bash
cd browser-extension
npm ci
npm test         # parsowanie, dopasowanie adresów, transformacje (36 asercji)
npm run test:e2e # Chromium z załadowanym rozszerzeniem + formularz demo
npm run shots    # odtworzenie zrzutów z tej strony (docs/img/wtyczka-*.png)
```

Test e2e sprawdza trzy rzeczy naraz: wypełnienie rozpoznanego formularza
(łącznie ze stanem po stronie strony, nie tylko `value`), milczenie wtyczki
na widoku bez profilu oraz oddanie stronie obcego kodu. Oba testy chodzą w CI
przy każdym PR do `master`.
