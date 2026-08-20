# Konfiguracja skanowania i profile

## Konfigurator (zalecany sposób)

1. Otwórz **`konfigurator.html`** z pendrive'a czytnika (`CIRCUITPY`) w Chrome/Edge.
   Możesz też użyć kopii z paczki wydania albo z repo — łączy się tak samo.
2. Kliknij **Połącz** i wybierz port „Urządzenie szeregowe USB":
   - firmware produkcyjny (C): jest **jeden** port,
   - firmware prototypowy (CircuitPython): wybierz **drugi** z dwóch
     (pierwszy to konsola — timeout przy połączeniu = przełącz na drugi).
3. Nagłówek pokaże wersję firmware i tryb pracy.

## Ustawienia urządzenia

| Ustawienie | Znaczenie |
|---|---|
| Opóźnienie klawiszy (ms) | pauza między znakami — zwiększ, gdy aplikacja gubi znaki |
| Pauza po TAB/ENTER (ms) | dodatkowy czas na przeskok fokusu w wolnych aplikacjach |
| Blokada duplikatów (ms) | ten sam kod w tym oknie czasu wpisze się raz (0 = wył.) |
| Tryb bez profilu | co robić z kodem niepasującym do żadnego profilu: przepisz 1:1 albo podziel w stałym miejscu |
| Prefiks / sufiks tekstowy | stały tekst doklejany przed/po kodzie (tryb bez profilu) |
| Klawisz kończący | zwykle ENTER |
| Gdy profil nie sparsuje kodu | wyślij surowy 1:1 albo pomiń skan |

## Profile — serce urządzenia

Profil mówi: **które kody łapać** (wykrywanie), **jak je pociąć na pola**
(parsowanie) i **co wpisać** (sekwencja akcji). Kody niepasujące do żadnego
włączonego profilu przepisują się 1:1.

Pola profilu:

- **włączony** — profil działa tylko z zaznaczonym; wyłączone zostają w
  konfiguracji jako szablony do włączenia,
- **Wykrywanie (regex)** — wzorzec dopasowywany do początku kodu, np. `^PRC;`,
- **Typ parsowania**:
  - *regex z grupami* — wzorzec z nawiasami, np.
    `^PRC;([^;]+);([^;]+);([^;]+);([^;]+)$` + mapa **Pola**: `imie=1, nazwisko=2, numer=3, dzial=4`,
  - *GS1* — wbudowany parser kodów GS1 (AI 01/17/10/21); pola stałe:
    `{gtin} {dataWaznosci} {dataWaznosciISO} {partia} {numerSeryjny}`,
- **Sekwencja akcji** — co czytnik „wystuka":
  - `{pole}` — wpisuje wartość pola,
  - `"tekst"` — wpisuje stały tekst,
  - `TAB ENTER ESC BACKSPACE UP DOWN LEFT RIGHT F1`–`F12` — naciska klawisz.

Przykłady sekwencji:

```
{imie} TAB {nazwisko} TAB {numer} TAB {dzial} ENTER
{gtin} TAB {dataWaznosciISO} TAB {partia} TAB {numerSeryjny} ENTER
{numer} TAB TAB ENTER TAB {imie} " " {nazwisko}
```

Uwaga do wzorców: silnik na urządzeniu wspiera `^ $ . [] * + ? ()` i klasy
`\d \w \s`; kwantyfikatory `{m,n}` rozpisuj jawnie (np. `[0-9][0-9][0-9]`) —
konfigurator pilnuje tego przy zapisie.

## Tryb testowy

Sekcja **Test** → zaznacz tryb testowy → skanuj. Skany pojawiają się na stronie
(surowa treść + dopasowany profil i pola), **nic nie wpisuje się do okien** —
idealne do strojenia profili. Po zakończeniu odznacz.

## Zapis konfiguracji i priorytety

- **Zastosuj (RAM)** — działa natychmiast, znika po odłączeniu zasilania,
- **Zapisz trwale (NVM)** — konfiguracja przeżywa restarty i aktualizacje,
- **Import/Eksport JSON** — kopia zapasowa / przenoszenie między urządzeniami.

Źródła konfiguracji w kolejności pierwszeństwa: **zapis trwały → plik
`config/config.json` na pendrivie → ustawienia fabryczne**. Edycja pliku ma
sens przy prowizjonowaniu wielu urządzeń; po pierwszym „Zapisz trwale" to zapis
trwały wygrywa (aż do „Ustawień fabrycznych").

## Ustawienia fabryczne

Przycisk w konfiguratorze (czyści zapis trwały) albo sprzętowo: przytrzymaj
przycisk podłączony do GP2 przez ~1 s podczas wpinania USB.

## Konfiguracja modułu skanera (jednorazowa)

Tryby pracy samego modułu (wyjście UART, skanowanie po zbliżeniu) ustawia się
kodami z manualu GM65 (`docs/GM65-manual.pdf`, str. 9 i 12) — szczegóły
w [INSTALL.md](INSTALL.md), sekcja 3.
