# Changelog

## 0.9.0 — 2026-08-20

Pierwsze wydanie paczkowane.

- Firmware CircuitPython: UART→USB HID, profile (regex z grupami + parser GS1
  z AI 01/17/10/21 i datą ISO), blokada duplikatów, pauzy po klawiszach,
  prefiks/sufiks, onError raw/skip.
- Kanał konfiguracyjny USB CDC (NDJSON): getConfig/setConfig/save/setMode/
  factoryReset/reboot/rebootBootloader; tryb testowy z eventami skanów.
- Trwały zapis konfiguracji w NVM (CRC + weryfikacja, fallback do pliku).
- Konfigurator WWW (single-file, WebSerial) na dysku urządzenia.
- Instalator Windows (install.ps1) i paczka wydania budowana w CI.
