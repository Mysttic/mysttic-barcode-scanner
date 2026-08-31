# Mysttic Barcode Scanner — on-device manual (CircuitPython prototype)

This drive is the scanner's own memory. A short crib sheet for whoever is
configuring it. The configurator's user interface is in Polish; the Polish
labels are given below in brackets.

## What is where

| File / directory | What it is | Safe to touch |
|---|---|---|
| `configurator.html` | the configuration page, open it in Chrome or Edge and click **Połącz** (Connect) | run it freely |
| `config/config.json` | scanner configuration (profiles, delays) | **editable** (keep it valid JSON) |
| `docs/` | this manual | read-only material |
| `boot.py`, `code.py`, the other `*.py` files | scanner firmware | **DO NOT TOUCH** |
| `lib/` | firmware libraries | **DO NOT TOUCH** |

## Two ways to configure it

1. **The configurator (recommended):** open `configurator.html` → **Połącz**
   (Connect) → pick the **second** "USB serial device" port → enable and edit
   profiles → **Zapisz trwale (NVM)** (Save permanently). A permanent save takes
   precedence over the file.
2. **The file:** edit `config/config.json` and replug USB. This works only as
   long as nothing has been saved permanently from the configurator, or after
   "Ustawienia fabryczne" (Factory settings), which clears the permanent copy.

## Quick procedures

- **Test without typing into windows:** configurator → the *Test* tab → tick
  test mode → scan (results appear on the page). Untick it when you are done.
- **Factory settings:** the button in the configurator, or hold the button wired
  to GP2 for about a second while plugging in USB.
- **The scanner beeps but types nothing:** see the documentation in the project
  repository (`docs/getting-started.md`). Most likely the scanner module's output
  is set wrongly, or TXD/RXD are swapped.
- **Update:** configurator → the *Aktualizacja* (Update) tab → follow the steps.

## What not to do

- Do not delete or change the `*.py` files or `lib/`, the scanner will stop
  working (repair: the installer from the release package).
- Do not edit `config/config.json` while the configurator is connected.
- Do not unplug USB during "Zapisz trwale" (Save permanently).
