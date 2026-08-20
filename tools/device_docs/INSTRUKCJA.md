# Czytnik kodów — instrukcja na urządzeniu

Ten pendrive to pamięć czytnika kodów. Krótka ściąga dla osoby konfigurującej.

## Co gdzie jest

| Plik / katalog | Co to | Czy można ruszać |
|---|---|---|
| `konfigurator.html` | strona konfiguracyjna — otwórz w Chrome/Edge i kliknij **Połącz** | uruchamiaj śmiało |
| `config/config.json` | konfiguracja czytnika (profile, opóźnienia) | **można edytować** (poprawny JSON!) |
| `docs/` | ta instrukcja | do czytania |
| `boot.py`, `code.py`, pozostałe `*.py` | firmware czytnika | **NIE RUSZAĆ** |
| `lib/` | biblioteki firmware | **NIE RUSZAĆ** |

## Konfiguracja — dwie drogi

1. **Konfigurator (zalecana):** otwórz `konfigurator.html` → **Połącz** → wybierz
   **drugi** port „Urządzenie szeregowe USB" → włączaj/edytuj profile →
   **Zapisz trwale (NVM)**. Zapis trwały ma pierwszeństwo przed plikiem.
2. **Plik:** edytuj `config/config.json` i odłącz/podłącz USB. Działa tylko,
   dopóki nic nie zapisano trwale z konfiguratora (albo po „Ustawieniach
   fabrycznych", które czyszczą zapis trwały).

## Szybkie procedury

- **Test bez wpisywania do okien:** konfigurator → sekcja *Test* → zaznacz tryb
  testowy → skanuj (wyniki na stronie). Po zakończeniu ODZNACZ.
- **Ustawienia fabryczne:** przycisk w konfiguratorze, albo przytrzymaj przycisk
  podłączony do GP2 ~1 s podczas wpinania USB.
- **Czytnik pika, nic nie wpisuje:** patrz `docs/INSTALL.md` w repozytorium
  projektu (sekcja „Najczęstsze problemy") — najpewniej moduł skanera ma
  przestawione wyjście albo zamienione przewody TXD/RXD.
- **Aktualizacja:** konfigurator → *Aktualizacja firmware* → postępuj wg kroków.

## Czego nie robić

- Nie kasuj i nie zmieniaj plików `*.py` ani `lib/` — czytnik przestanie działać
  (naprawa: instalator z paczki wydania).
- Nie edytuj `config/config.json` przy otwartym połączeniu konfiguratora.
- Nie odłączaj USB w trakcie „Zapisz trwale".
