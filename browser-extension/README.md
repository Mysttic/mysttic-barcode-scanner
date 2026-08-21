# Rozszerzenie przegladarki

Wypelnia formularze danymi ze skanu **po nazwach pol** — dla stron, na ktorych
sekwencja TAB-ow jest zbyt krucha. Poza rozpoznanymi formularzami rozszerzenie
nie robi nic i czytnik zachowuje sie jak zwykla klawiatura.

Instrukcja uzytkownika (instalacja, tryb nauki, format profilu):
[docs/WTYCZKA.md](../docs/WTYCZKA.md).

## Uklad plikow

| Plik | Rola |
|---|---|
| `manifest.json` | MV3; content script na wszystkich stronach, uprawnienie tylko `storage` |
| `src/parse.js` | ramka -> nazwane pola (`delimited` / `regex` / `gs1`) |
| `src/fill.js` | wstawianie wartosci odporne na React/Vue/Angular + odczyt zwrotny |
| `src/store.js` | profile formularzy, dopasowanie adresu, ustawienia |
| `src/content.js` | rozpoznanie formularza (takze w SPA), przechwycenie skanu, tryb nauki |
| `src/background.js` | badge ze stanem + rozglaszanie zmian konfiguracji |
| `src/popup.*` | stan biezacej karty, wlacznik, wejscie w tryb nauki |
| `src/options.*` | lista profili + edycja/import/eksport JSON |

Bez bundlera — pliki ida do przegladarki takie, jakie sa w repozytorium.
`package.json` istnieje wylacznie dla testow.

## Testy

```bash
npm ci
npm test          # jednostkowe: parsowanie, dopasowanie adresow, transformacje
npm run test:e2e  # Chromium z zaladowanym rozszerzeniem + test-vectors/forma-c-wtyczka.html
```

Zrzuty do dokumentacji (`docs/img/wtyczka-*.png`) odtwarza `npm run shots` —
ten sam scenariusz przechodzony na zywo w Chromium, wiec obrazki nie rozjezdzaja
sie z kodem.

Test e2e wymaga przegladarki Playwrighta (`npx playwright install chromium`)
i srodowiska graficznego (`xvfb-run -a npm run test:e2e` na serwerze).
