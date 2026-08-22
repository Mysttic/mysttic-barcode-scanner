# Czytnik kodów 1D/2D — instrukcja (dysk urządzenia)

Wszystko, czego potrzebujesz do konfiguracji, jest na tym dysku.
Dysk jest **tylko-do-odczytu**: to nośnik narzędzi, nie konfiguracji.
Konfiguracja żyje w pamięci czytnika i przeżywa restarty oraz aktualizacje.

## Konfiguracja (inżynier)

1. Otwórz z tego dysku **`konfigurator.html`** w Chrome lub Edge.
2. Kliknij **Połącz** i wybierz port „Urządzenie szeregowe USB".
3. Zakładki: **Urządzenie** (opóźnienia, blokada duplikatów),
   **Profile** (wykrywanie → parsowanie → sekwencja akcji),
   **Test** (podgląd skanów bez wpisywania do okien),
   **Aktualizacja**, **Serwis** (import/eksport JSON, ustawienia fabryczne).
4. **Zastosuj** = do restartu; **Zapisz trwale** = na stałe.

Profil mówi: które kody łapać (regex), jak je pociąć na pola
(regex z grupami albo parser GS1) i co wpisać (sekwencja
`{pole} TAB "tekst" ENTER`). Kody bez profilu przepisują się 1:1.

## Testy — od razu po podłączeniu

Otwórz z tego dysku **`testy.html`** — lista formularzy testowych z kodami
do skanowania prosto z ekranu. Testy „wtyczka" wymagają rozszerzenia
przeglądarki z repozytorium projektu (`browser-extension/`) z włączonym
dostępem do adresów URL plików. Instrukcja wtyczki — instalacja, uczenie
nowych profili i zarządzanie nimi — jest na tym dysku: **`WTYCZKA.md`**,
a samouczek nauki profilu krok po kroku: **`NAUKA-PROFILU.md`**.

## Codzienna praca (operator)

Podłącz i skanuj — czytnik jest klawiaturą USB, działa w każdej
aplikacji bez instalowania czegokolwiek. Kliknij w pole startowe
formularza i zeskanuj kod.

## Najczęstsze problemy

| Objaw | Co zrobić |
|---|---|
| pika, ale nie wpisuje | zamienione przewody TXD/RXD albo moduł skanera przestawiony na USB (kod „Series Output" z manuala GM65, str. 9) |
| wpisuje podwójnie | zwiększ „Blokadę duplikatów" w konfiguratorze (domyślnie 1,5 s) |
| gubi znaki w wolnej aplikacji | zwiększ „Opóźnienie klawiszy" i „Pauzę po TAB/ENTER" |
| konfigurator: timeout po połączeniu | wybrany zły port — rozłącz i wybierz drugi z listy |

## Ustawienia fabryczne

Przycisk **Ustawienia fabryczne** w zakładce Serwis konfiguratora,
albo sprzętowo: przytrzymaj przycisk podłączony do GP2 przez ~1 s
podczas wpinania USB.

## Aktualizacja firmware

1. Pobierz paczkę wydania (adres w zakładce **Aktualizacja**)
   i zweryfikuj sumę SHA-256.
2. Konfigurator → **Aktualizacja** → **Restart do bootloadera** —
   pojawi się dysk `RPI-RP2` (albo ręcznie: przytrzymaj BOOT i wciśnij RST).
3. Przeciągnij plik `.uf2` z paczki na `RPI-RP2`. Czytnik wróci sam,
   z nienaruszoną konfiguracją.

## Czego nie robić

- Nie formatuj tego dysku (i tak się nie da — jest tylko-do-odczytu).
- Nie wgrywaj `.uf2` niewiadomego pochodzenia — tylko z paczek wydania.
