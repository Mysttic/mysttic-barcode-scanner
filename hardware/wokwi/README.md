# Schemat połączeń — Wokwi

Wizualny schemat prototypu (Etap 1 instrukcji): RP2040 (Pico / klon typu YD-RP2040) + moduł skanera GM65 + płytka stykowa z LED / przyciskiem / buzzerem.

**Zapisany projekt:** https://wokwi.com/projects/472807254038722561 (konto mystticdruid)

## Połączenia (1:1 z instrukcją w Notion)

UART idzie bezpośrednio (przewody dupont), zasilanie przez szyny płytki stykowej:

| Skąd | Dokąd | Kolor | Uwagi |
|------|-------|-------|-------|
| Pico VBUS (5 V) | szyna + płytki (`tp`) | czerwony | 5 V z USB |
| Pico GND | szyna − płytki (`tn`) | czarny | wspólna masa — podłączyć jako pierwszą |
| GM65 VCC | szyna + | czerwony | GM65 wymaga 5 V |
| GM65 GND | szyna − | czarny | |
| GM65 TX | Pico GP1 = RX0 (pin 2) | żółty | UART na krzyż |
| GM65 RX | Pico GP0 = TX0 (pin 1) | zielony | UART na krzyż |

Elementy na płytce stykowej (opcjonalne):

| Element | Kolumny | Sterowanie | Uwagi |
|---------|---------|------------|-------|
| Rezystor 330 Ω | 7–10 (rząd b) | GP6 → kol. 7 (pomarańczowy) | szeregowo z LED |
| LED (anoda kol. 10, katoda kol. 12) | 10–12 (rząd a) | — | katoda zworką do szyny − |
| Przycisk TRIG | 16–18 (rząd b) | GP2 → kol. 16 (fioletowy) | druga nóżka zworką do szyny −; pull-up wewnętrzny w firmware |
| Buzzer (+ kol. 22, − kol. 24) | 22–24 (rząd b) | GP7 → kol. 22 (cyjan) | na docelowej płytce przez tranzystor NPN (baza przez 1 kΩ), jeśli pobiera >10 mA |

## Fabryczna wiązka posiadanego modułu (UWAGA — kolory!)

Silk przy złączu JST modułu: `GND | RXD | TXD | VCC` (sekcja „UART"). Kolory wiązki **nie** trzymają się konwencji:

| Kolor przewodu | Pin modułu | Dokąd |
|---|---|---|
| zielony | VCC | szyna +5 V |
| żółty | GND | szyna GND |
| fioletowy | TXD (nadaje) | GP1 = RX Pico |
| niebieski | RXD (odbiera) | GP0 = TX Pico |

Kieruj się opisami pinów na module, nie kolorami. Moduł ma własny buzzer i przycisk wyzwalania — zewnętrzne LED/przycisk/buzzer ze schematu są opcjonalne.

## Konwerter poziomów — celowo nieobecny

GM65 komunikuje się TTL **3,3 V**, więc konwerter jest zbędny. Dodaj go **tylko jeśli** pomiar/karta katalogowa Twojego modułu pokaże 5 V na TX skanera (GPIO RP2040 nie są 5V-tolerant):

```
TX skanera ──[1 kΩ]──●──→ GP1 (RX Pico)
                     │
                   [2 kΩ]
                     │
                    GND
```

Nie wstawiaj dzielnika „na zapas" przy linii 3,3 V — 3,3 V × 2/3 ≈ 2,2 V, czyli poziom na granicy logicznej jedynki RP2040.

## Jak otworzyć od zera

1. https://wokwi.com/projects/new/micropython-pi-pico
2. Podmień `main.py` i `diagram.json`, dodaj `gm65.chip.c` i `gm65.chip.json` (▼ przy zakładkach → *New file…*).

## Ograniczenie symulatora (2026-08)

`machine.UART` w Wokwi na `wokwi-pi-pico` nie działa (konstruktor się zawiesza; UART0 dodatkowo koliduje z konsolą REPL). Symulacja służy więc jako **schemat + atrapa skanera**: `gm65.chip.c` cyklicznie wysyła kody EAN-13 i loguje je w zakładce **CHIPS CONSOLE**. Odbiór po stronie Pico testujemy na prawdziwym sprzęcie (CircuitPython, Etap 2).
