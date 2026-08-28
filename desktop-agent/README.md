# Agent desktopowy (moduł niezależny)

Odpowiednik wtyczki przeglądarkowej dla **aplikacji desktopowych**: siedzi
w zasobniku, rozpoznaje okno aplikacji, przechwytuje skan z czytnika
i odtwarza nauczone makro (pola, kliknięcia, klawisze).

Moduł jest **całkowicie niezależny** od wtyczki i od firmware — czytnik
pracuje w zwykłym trybie klawiatury USB, bez żadnych zmian w konfiguracji.

Instrukcja użytkownika: [docs/AGENT-DESKTOP.md](../docs/AGENT-DESKTOP.md).

## Układ plików

| Plik | Rola |
|---|---|
| `src/CzytnikAgent/Native.cs` | Win32: hooki, SendInput, okna, globalny skrót |
| `src/CzytnikAgent/Model.cs` | profil aplikacji + magazyn JSON (`%APPDATA%\CzytnikAgent`) |
| `src/CzytnikAgent/ParserSkanu.cs` | ramka → nazwane pola (`delimited`/`regex`/`gs1`) — port z wtyczki i firmware |
| `src/CzytnikAgent/Uia.cs` | UI Automation: szukanie kontrolek, wpisywanie, odczyt zwrotny |
| `src/CzytnikAgent/Makro.cs` | odtwarzanie kroków (UIA → współrzędne → aktywne pole) |
| `src/CzytnikAgent/Wedge.cs` | hook klawiatury, rozpoznanie skanu po tempie, oddawanie znaków |
| `src/CzytnikAgent/Nagrywarka.cs` | nagrywanie czynności operatora jako kroków makra |
| `src/CzytnikAgent/OknoNauki.cs` | kreator: skan → nazwy segmentów → nagranie → zapis |
| `src/CzytnikAgent/TrayApp.cs` | ikona w zasobniku, menu, skrót Ctrl+Alt+F9 |
| `src/CzytnikAgent/Log.cs` | log pracy (`%APPDATA%\CzytnikAgent\agent.log`) |
| `test-app/` | aplikacja testowa (WinForms): logowanie + karta pracownika |
| `tests/TestyAgenta/` | testy jednostkowe (parser, wzorce, nagrywarka) |
| `tests/test_e2e.py` | testy e2e na żywej aplikacji i prawdziwym UIA |

## Budowanie

```bash
dotnet build -c Release desktop-agent/src/CzytnikAgent
```

```bash
dotnet build -c Release desktop-agent/test-app
```

## Testy

```bash
dotnet run -c Release --project desktop-agent/tests/TestyAgenta
```

```bash
python desktop-agent/tests/test_e2e.py
```

Jednostkowe: 34 asercje (parser na tych samych wektorach co firmware i wtyczka,
dopasowanie okien, scalanie nagranych kroków). E2E: 27 asercji na prawdziwej
aplikacji WinForms — rozpoznanie okna, widoczność kontrolek w UIA, wypełnienie
przez makro z weryfikacją stanu aplikacji, nietknięte pola-pułapki, odrzucenie
obcego kodu oraz **pełna ścieżka z hookiem** (agent w tle przechwytuje skan, także
w stylu prawdziwego czytnika: Shift + wielkie litery) i **przeładowanie profili
bez restartu**.

## Wydanie

```bash
python tools/build_release.py --skip-npm
```

Do paczki wydania trafia katalog `agent-desktopowy/` (samodzielny `CzytnikAgent.exe`,
instalator `zainstaluj-agenta.ps1`, przykładowy profil, instrukcja), a obok niej
powstaje osobny plik `aplikacja-testowa-v<wersja>-win-x64.zip` — przenośna
aplikacja do prób. Oba pliki są budowane jako **self-contained**, więc u klienta
nie trzeba instalować .NET.

Gdy paczkę składa system inny niż Windows (tak działa CI), gotowe pliki `.exe`
przekazuje się przełącznikami `--agent-exe` i `--app-testowa-exe`; buduje je
osobny job na `windows-latest`. Szybki build lokalny bez agenta: `--bez-agenta`.

Zrzuty ekranu do instrukcji (`docs/img/agent-*.png`) odtwarza:

```bash
CzytnikAgent.exe --zrzuty ..\..\docs\img --proces AplikacjaTestowa
```

(przy uruchomionej aplikacji testowej) — scenariusz przechodzi kreator na żywo,
więc obrazki nie rozjeżdżają się z kodem.

## Tryby diagnostyczne

```bash
CzytnikAgent.exe --okno --proces AplikacjaTestowa
```

```bash
CzytnikAgent.exe --drzewo --proces AplikacjaTestowa
```

```bash
CzytnikAgent.exe --symuluj "PRC;JAN;KOWALSKI;12345;IT" --proces AplikacjaTestowa --profile plik.json
```

`--drzewo` wypisuje kontrolki widziane przez UI Automation (tym sprawdzisz,
czy dana aplikacja w ogóle nadaje się do celowania po identyfikatorach),
`--symuluj` odtwarza makro bez czytnika, `--wyslij` udaje czytnik (testy),
`--hook-test` sprawdza, czy hook klawiatury dostaje zdarzenia.
