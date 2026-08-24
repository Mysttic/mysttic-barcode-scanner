# Wektory testowe

Punkt wejścia: **`testy.html`** — menu wszystkich formularzy z opisem, czego
oczekiwać. Ten sam komplet (testy.html + `formularze/`) jest wbudowany w dysk
`CZYTNIK` czytnika, więc testować można prosto z urządzenia. Pełny scenariusz
„od pudełka": [docs/TESTING.md](../docs/TESTING.md), sekcja 0.

Wszystkie testy chodzą na JEDNEJ, produkcyjnej konfiguracji czytnika
(profile `pracownik-tab` i `gs1-datamatrix` włączone).

## Formularze demonstracyjne

| Plik | Kod | Mechanizm |
|---|---|---|
| `formularze/forma-a-tab.html` | `PRC;JAN;KOWALSKI;12345;IT` (`qr_prc.png`) | profil **pracownik-tab** w czytniku tnie kod na pola i wysyła `imię TAB nazwisko TAB numer TAB dział ENTER` — strona jest „głupia", liczy się kolejność pól |
| `formularze/forma-b-nazwy.html` | `EMP;ANNA;NOWAK;67890;HR` (`qr_emp.png`) | czytnik pracuje 1:1 (kod nie pasuje do profilu), a **strona** nasłuchuje klawiatury (keyboard-wedge), rozpoznaje ramkę po prefiksie `EMP;` i rozdziela wartości do pól po `name` |
| `formularze/forma-gs1.html` | GS1 QR (osadzony) | profil **gs1-datamatrix** rozbiera kod i wypełnia TAB-ami: GTIN, data ISO, partia, numer seryjny |
| `formularze/forma-c-wtyczka.html` | ten sam kod co w A | **wtyczka** przechwytuje sekwencję TAB-ową czytnika i rozkłada pola po nazwach — pola pomieszane, między nimi pułapki, strona jest SPA (drugi widok celowo bez profilu) |
| `formularze/forma-c-lek.html` | GS1 DataMatrix jak na prawdziwym leku (`dm_lek.png`): `(01)05909991055172 (17)271000 (10)A23G05 (21)K7L9XW24MQ1R` | czytnik parsuje GS1 (data „00" → koniec miesiąca), **drugi profil wtyczki** przechwytuje sekwencję i trafia w pola zamówienia — pokaz przełączania profili |

Pliki są samowystarczalne (kody osadzone w HTML) — skanujesz prosto z ekranu.

Wariant B to wzorzec „aplikacja współpracująca" bez wtyczki (strony, które
kontrolujemy). Wariant C robi to samo na obcych stronach — instalacja, tryb
nauki i zarządzanie profilami wtyczki: [docs/WTYCZKA.md](../docs/WTYCZKA.md).
Diagnostyczny bookmarklet (wariant C bez instalacji): `bookmarklet.html`.

## Jak uruchomić

- **Z czytnika:** podłącz i otwórz `testy.html` z dysku `CZYTNIK`
  (wtyczka: włącz „Zezwalaj na dostęp do adresów URL plików").
- **Z repo:** otwórz `testy.html` dwuklikiem albo `python -m http.server 8124`
  w tym katalogu i wejdź na `http://localhost:8124/testy.html`.
