# Wektory testowe

## Formularze demonstracyjne (dane pracownika)

| Plik | Kod | Mechanizm |
|---|---|---|
| `forma-a-tab.html` | `PRC;JAN;KOWALSKI;12345;IT` (`qr_prc.png`) | profil **pracownik-tab** w czytniku tnie kod na pola i wysyła `imię TAB nazwisko TAB numer TAB dział ENTER` — strona jest „głupia", liczy się kolejność pól |
| `forma-b-nazwy.html` | `EMP;ANNA;NOWAK;67890;HR` (`qr_emp.png`) | czytnik pracuje 1:1 (kod nie pasuje do profilu), a **strona** nasłuchuje klawiatury (keyboard-wedge), rozpoznaje ramkę po prefiksie `EMP;` i rozdziela wartości do pól po `name` — kolejność/fokus bez znaczenia |

| `forma-c-wtyczka.html` | `PRC;JAN;KOWALSKI;12345;IT` (`qr_prc.png`) | **wtyczka** rozpoznaje formularz (adres + obecność pól) i rozkłada skan po nazwach — pola są w innej kolejności niż dane, między nimi pola-pułapki, a strona jest SPA (drugi widok celowo bez profilu) |

Pliki są samowystarczalne (QR osadzony w HTML) — kody można skanować prosto z ekranu.

Wariant B pokazuje wzorzec „aplikacja współpracująca" bez wtyczki: działa na stronach, do których możemy dodać skrypt. Wariant C robi to samo na stronach, których kodu nie kontrolujemy — instalacja i konfiguracja wtyczki: [docs/WTYCZKA.md](../docs/WTYCZKA.md).

## Jak uruchomić test

1. Otwórz `konfigurator.html` (leży na dysku `CIRCUITPY`) w Chrome/Edge → **Połącz** → wybierz drugi port („USB Serial Device (COM5)"; pierwszy to konsola).
2. Włącz profil **pracownik-tab** → **Zastosuj** (albo **Zapisz trwale**).
3. Otwórz `forma-a-tab.html`, kliknij w pole „Imię", zeskanuj kod z ekranu.
4. Otwórz `forma-b-nazwy.html`, po prostu zeskanuj kod — pola wypełnią się same po nazwach.
5. Zainstaluj wtyczkę (`chrome://extensions` → *Załaduj rozpakowane* → `browser-extension/`), otwórz `forma-c-wtyczka.html` i zeskanuj kod — bez klikania w pola. Przełącz na widok *Ustawienia*, żeby zobaczyć, że poza profilem wtyczka milczy.
