# Wtyczka Chrome/Edge — wypełnianie pól po selektorach (Etap 12)

Czytnik pozostaje zwykłą klawiaturą USB i wpisuje ramkę `WEB;pole1;pole2;…`
zakończoną Enterem (kod `WEB;…` nie pasuje do żadnego profilu w czytniku, więc
przechodzi 1:1). Wtyczka na stronie pasującej do profilu przechwytuje ramkę
i wstawia wartości w pola wskazane **selektorami CSS** — kolejność pól, fokus
i framework strony (React/Angular) nie mają znaczenia.

## Instalacja (raz na przeglądarkę)

1. Wejdź na `chrome://extensions` (Edge: `edge://extensions`).
2. Włącz **Tryb dewelopera** (przełącznik w rogu).
3. Kliknij **Załaduj rozpakowane** i wskaż katalog `browser-extension/` z repo
   (albo z paczki wydania).
4. Gotowe — na stronach z profilem w prawym dolnym rogu pojawia się plakietka
   `📷 nasłuch: <nazwa profilu>`.

Wdrożenie firmowe: rozszerzenie można wymusić polityką (GPO/Intune,
`ExtensionInstallForcelist`) — wtedy stanowiska nie wymagają trybu dewelopera.

## Użycie (operator)

1. Otwórz stronę docelową — plakietka 📷 potwierdza aktywny profil.
2. Zeskanuj kod — pola wypełniają się i migają na zielono; plakietka pokazuje
   liczbę wypełnionych pól. Nie trzeba klikać w żadne pole przed skanem.

Kod testowy: `test-vectors/qr_web.png`
(`WEB;Jan;Kowalski;jan.kowalski@example.com;5551234567;Krotka 7;Warszawa;22-100;2026-08-31;Tokyo`).

## Konfiguracja (inżynier)

Ikona wtyczki → **Profile stron…** (albo `chrome://extensions` → Szczegóły →
Opcje):

- **Prefiks ramki** i **pola ramki** (kolejność = kolejność w skanowanym kodzie),
- **profile stron**: host (+ opcjonalna dokładna ścieżka) i mapowania
  `selektor => szablon`, po jednym na linię, np.:

  ```
  #first_name => {imie}
  [id="customer.address.city"] => {miasto}
  #state => mazowieckie
  #currentAddress => {ulica}, {kod} {miasto}
  ```

- **Import/Eksport JSON** — prowizjonowanie wielu stanowisk tym samym plikiem.

Zapis działa natychmiast na otwartych kartach. Profil ze ścieżką umieszczaj nad
ogólnym profilem tego samego hosta (pierwszy pasujący wygrywa). Strony bez
profilu: wtyczka jest całkowicie bierna (brak plakietki, znaki lecą normalnie).

## Pliki

| Plik | Rola |
|---|---|
| `manifest.json` | Manifest V3; content script na wszystkich stronach + uprawnienie `storage` |
| `profiles.js` | domyślna konfiguracja (8 stron poligonu) + dopasowanie profilu |
| `content.js` | nasłuch wedge, wypełnianie (natywny setter + `input`/`change`), plakietka, ponowienie dla SPA |
| `options.html/js` | edytor profili + import/eksport JSON |
| `popup.html/js` | włącznik globalny + skrót do ustawień |

Strony do testów z selektorami pól: `docs/FORMULARZE.md` (sekcja „Poligon").
Wariant awaryjny bez instalacji: `test-vectors/bookmarklet.html`.
