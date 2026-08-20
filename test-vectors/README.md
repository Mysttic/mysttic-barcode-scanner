# Wektory testowe

## Formularze demonstracyjne (dane pracownika)

| Plik | Kod | Mechanizm |
|---|---|---|
| `forma-a-tab.html` | `PRC;JAN;KOWALSKI;12345;IT` (`qr_prc.png`) | profil **pracownik-tab** w czytniku tnie kod na pola i wysyła `imię TAB nazwisko TAB numer TAB dział ENTER` — strona jest „głupia", liczy się kolejność pól |
| `forma-b-nazwy.html` | `EMP;ANNA;NOWAK;67890;HR` (`qr_emp.png`) | czytnik pracuje 1:1 (kod nie pasuje do profilu), a **strona** nasłuchuje klawiatury (keyboard-wedge), rozpoznaje ramkę po prefiksie `EMP;` i rozdziela wartości do pól po `name` — kolejność/fokus bez znaczenia |

Oba pliki są samowystarczalne (QR osadzony w HTML) — kody można skanować prosto z ekranu.

Wariant B pokazuje wzorzec „aplikacja współpracująca" bez wtyczki: działa na stronach, do których możemy dodać skrypt. Wypełnianie pól po nazwie na **obcych** stronach wymaga rozszerzenia przeglądarki (Etap 12).

## Jak uruchomić test

1. Otwórz `konfigurator.html` (leży na dysku `CIRCUITPY`) w Chrome/Edge → **Połącz** → wybierz drugi port („USB Serial Device (COM5)"; pierwszy to konsola).
2. Włącz profil **pracownik-tab** → **Zastosuj** (albo **Zapisz trwale**).
3. Otwórz `forma-a-tab.html`, kliknij w pole „Imię", zeskanuj kod z ekranu.
4. Otwórz `forma-b-nazwy.html`, po prostu zeskanuj kod — pola wypełnią się same po nazwach.
