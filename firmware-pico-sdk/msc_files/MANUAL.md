# Mysttic Barcode Scanner - manual (device disk)

Everything needed to configure the scanner is on this disk. The disk is
**read-only**: it carries tools, not settings. The configuration itself lives in
the scanner's own memory and survives restarts and firmware updates.

The configurator is in English; the language selector in its top right corner
also offers Polish.

## Configuration (engineer)

1. Open **`configurator.html`** from this disk in Chrome or Edge.
2. Click **Connect** and choose the "USB serial device" port.
3. Tabs: **Device** (delays, duplicate blocking), **Profiles** (detection →
   parsing → action sequence), **Test** (preview scans without typing into any
   window), **Update**, **Service** (JSON import and export, factory settings).
4. **Apply** lasts until the next restart; **Save permanently** writes it to
   flash.

A profile says which codes to catch (a regular expression), how to cut them into
fields (a regular expression with groups, or the GS1 parser) and what to type
(a sequence of `{field} TAB "text" ENTER`). Codes with no matching profile are
typed through verbatim.

## Tests, straight after plugging in

Open **`tests.html`** from this disk: a list of test forms with codes you can
scan right off the screen. The "extension" tests need the browser extension from
the project repository (`browser-extension/`) with access to file URLs enabled.
The extension manual, covering installation, teaching new profiles and managing
them, is on this disk as **`BROWSER-EXTENSION.md`**, together with the
step-by-step tutorial for teaching a new form.

## Everyday work (operator)

Plug it in and scan. The scanner is a USB keyboard and works in any application
without installing anything. Click the first field of the form and scan.

## Common problems

| Symptom | What to do |
|---|---|
| beeps but types nothing | TXD/RXD swapped, or the scanner module is set to USB output (scan the "Series Output" code from the GM65 manual) |
| types everything twice | increase "Duplicate block" in the configurator, 1.5 s by default |
| drops characters in a slow application | increase "Key delay" and "Pause after TAB/ENTER" |
| configurator: timeout after connecting | wrong port picked, disconnect and choose the other one |

## Factory settings

The **Factory settings** button on the Service tab of the configurator, or in
hardware: hold the button wired to GP2 for about a second while plugging in USB.

## Firmware update

1. Download the release package (the address is on the **Update** tab) and
   verify its SHA-256 sum.
2. Configurator → **Update** → **Restart into the bootloader**. An `RPI-RP2`
   disk appears (or do it by hand: hold BOOT, press RST).
3. Drag the `.uf2` file from the package onto `RPI-RP2`. The scanner comes back
   by itself with the configuration untouched.

## What not to do

- Do not try to format this disk (you cannot, it is read-only).
- Do not flash a `.uf2` of unknown origin, only files from release packages.

---

Project and sources: https://github.com/Mysttic/mysttic-barcode-scanner
Licensed under the Apache License 2.0.
