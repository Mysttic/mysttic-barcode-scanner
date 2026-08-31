# Architecture and technical details

## Hardware

- an **RP2040** board with native USB (Raspberry Pi Pico or a clone such as the
  YD-RP2040),
- a scanner module with a TTL UART (we use a **Waveshare 14810**; GM65 and
  GM805 behave the same), 3.3 V signalling on a 5 V supply, wired
  `TXD→GP1`, `RXD→GP0`, `VCC→VBUS`, `GND→GND`,
- optionally: a status LED (GP6), a service and factory-reset button (GP2), a
  buzzer (the module has its own). Extended prototype schematic:
  [hardware/wokwi](../hardware/wokwi/README.md). Where to buy the parts and which
  ones we have tested: [HARDWARE.md](HARDWARE.md).

## Two firmware variants

| | CircuitPython (`firmware-circuitpython/`) | C / Pico SDK + TinyUSB (`firmware-pico-sdk/`) |
|---|---|---|
| role | prototyping, quick fixes | **production** |
| USB | HID + 2×CDC (console and data) + a writable CIRCUITPY disk | HID + 1×CDC + a **read-only `MYSTTIC` disk (MSC)** |
| configuration storage | NVM (header plus CRC), falling back to `config/config.json` | **atomic A/B slots** in the last two flash sectors (magic, seq, CRC16) |
| robustness | no watchdog, files the user can edit | a 3 s watchdog, no files to break |
| profile regexes | CircuitPython's `re` (ure) | a bespoke `mini_regex` (a subset of ure plus groups, with a step limit) |

Both versions use **the same configuration format** and **the same CDC
protocol**, so the configurator and the tools work with either.

Note: the C slots and CircuitPython's NVM occupy the same final flash sectors, so
writing in one variant invalidates (through the CRC) what the other wrote.

## The scan processing pipeline

```
UART (9600 8N1) -> framing (CR/LF terminators or a silence timeout)
  -> duplicate blocking -> profiles (regex detection -> regexGroups/GS1 parsing)
  -> a list of actions (text and keys) -> the HID queue with delays
  -> [test mode: a JSON event over CDC instead of HID]
```

The browser extension hooks onto the end of this chain, on the host side rather
than the device: on a recognised page it captures what the scanner types (a frame
with a prefix, **or the whole TAB sequence from a device profile**, in which case
the TABs are blocked and do not move focus), parses it with its own engine
(`browser-extension/src/parse.js`) and writes the values into fields by name. The
precedence rule is **extension beats variant A on recognised pages**; elsewhere
the scanner types like an ordinary keyboard. The firmware knows nothing about the
extension and stays in one production configuration. Note that non-printable
characters do not survive HID, so the GS separator 0x1D never reaches the
extension: there the field boundaries come from the scanner's sequence. Details
in [BROWSER-EXTENSION.md](BROWSER-EXTENSION.md).

Raw bytes live until parsing (the GS separator 0x1D passes through untouched).
GS1 rules: AI 01 (14 digits), 17 (YYMMDD, with day 00 meaning the last day of the
month), 10 and 21 (variable, up to 20 characters, terminated by GS or the end of
the code), and the AIM ID is stripped.

## The configuration protocol (USB CDC, NDJSON)

One line is one JSON object; responses carry `ok` and echo `requestId`. Commands:
`ping`, `getConfig`, `setConfig` (validate, then activate in RAM), `save` (store
permanently), `setMode` (`hid` or `test`), `factoryReset`, `reboot`,
`rebootBootloader`. In `test` mode the device sends events
`{"event":"scan", "rawBase64", "hex", "profile", "fields"}`. The client MUST
assert **DTR**; without it the device sends nothing.

## Configuration format

Versioned JSON (`version: 1`) with the sections `device` (delays), `scanner`
(baud rate, terminators, frame timeout, duplicate blocking), `output`
(no-profile mode, prefix and suffix, onError) and `profiles[]`
(`detect.regex` → `parse.regexGroups|gs1` → `output[]` of `field/key/text`
actions). Regex patterns are a subset without `{m,n}` (and without `|` in the C
version), validated both on the device and in the configurator. A full example:
[firmware-circuitpython/default_config.json](../firmware-circuitpython/default_config.json).

## The `MYSTTIC` disk (variant C, MSC)

A FAT12 image (256 KB, with subdirectories and long file names) generated on
every build by `tools/make_msc_image.py` from files in the repository
(deterministically, with a read-back self-test) and embedded in the UF2. TinyUSB
serves it over MSC as a **read-only** disk (writes and formatting are rejected).
The scanner's configuration is NOT on the disk (it lives in flash slots, reached
over CDC); the disk carries tools only:

```
README.TXT              quick start (ASCII)
MANUAL.md               device manual
BROWSER-EXTENSION.md    extension manual
LEARNING-PROFILES.md    profile learning tutorial
configurator.html       the configurator (Web Serial; byte for byte the file from configurator/dist)
tests.html              a menu of the test forms
forms/                  5 self-contained forms with codes to scan
```

## File layout on the device (CircuitPython variant)

```
configurator.html    the configuration tool (safe to run)
config/config.json   startup configuration (editable)
docs/MANUAL.md       the engineer's crib sheet
boot.py, *.py, lib/  firmware - DO NOT TOUCH
```

## Repository layout

| Directory | Contents |
|---|---|
| `firmware-circuitpython/` | the CP firmware, `tests/test_firmware.py`, the `diag_*.py` diagnostics and `setup_induction.py` |
| `firmware-pico-sdk/` | the C firmware (CMake and TinyUSB) plus `tests/test_host.c` |
| `configurator/` | configurator sources (Vite, TypeScript, zod, built into a single HTML file) |
| `browser-extension/` | the MV3 extension (no bundler) plus unit and e2e tests |
| `desktop-agent/` | the agent for Windows applications (C#/.NET, optional), the demo application and tests |
| `tools/` | `build_release.py`, `install.ps1`, `test_e2e.py`, `device_docs/` |
| `test-vectors/` | demo forms and QR codes |
| `hardware/` | schematics (Wokwi) and pinned installer files |
| `brand/` | logo and icon sources plus the scripts that rasterise them |
| `docs/` | documentation |

## Building and releases

- Configurator: `cd configurator && npm ci && npm run build` → `dist/index.html`.
- C firmware: CMake, Ninja and ARM GCC with `PICO_SDK_PATH` →
  `build/mysttic_barcode_scanner.uf2` (note that SDK 2.x also needs a host
  compiler for picotool).
- Package: `python tools/build_release.py` →
  `release/mysttic-barcode-scanner-v<version>.zip` (the version comes from
  [VERSION.md](../VERSION.md)). It contains the **production variant C UF2**
  (`firmware/`, with the `MYSTTIC` disk inside), the **extension**
  (`browser-extension/`, its manifest version taken from VERSION.md), the
  documentation and, separately, the prototype variant
  (`circuitpython-prototype/`). The order matters: configurator → C firmware
  (because the configurator goes into its disk image) → package.
- CI: tests on every pull request to `master`; a test package from *Run
  workflow*; a release automatically after a merge from `develop`, and only when
  the version has been raised.

## Tests and verification

| Level | What | How much |
|---|---|---|
| Python host tests | framer, parser, profiles, GS1, NVM, CDC (`firmware-circuitpython/tests`) | 52 assertions |
| C host tests | the same vectors plus mini_regex, config_parse, slots, matcher (`firmware-pico-sdk/tests`) | 87 assertions |
| extension unit | delimited/regex/GS1 parsing, address matching, transformations | 96 assertions |
| extension e2e | real Chromium with the extension: TAB frames, silence without a profile, cross-rejection | 22 assertions |
| desktop agent unit | parser, window matching, processing a recording (`desktop-agent/tests/TestyAgenta`) | 34 assertions |
| desktop agent e2e | a real WinForms application plus UI Automation (`desktop-agent/tests/test_e2e.py`) | 27 assertions |
| hardware | `tools/test_e2e.py` (CDC, persistence, HID) plus the out-of-the-box scenario ([TESTING.md](TESTING.md), 7 tests from the disk) | — |

Every automated level runs in CI on pull requests to `master`. The rule: any
change to parsing logic gets the same vector in all implementations
(CircuitPython, C, extension). Documentation screenshots are regenerated with
`npm run shots`, so the images do not drift away from the code. The capability
matrix and the verified code formats: [CAPABILITIES.md](CAPABILITIES.md).

## Scanner module pinout and protocol

The module's manual is copyrighted by its manufacturer and is not redistributed here;
see [HARDWARE.md](HARDWARE.md) for where to obtain it. The module is configured
either with barcodes from that manual (UART output, induction mode) or over UART
commands (`7E 00 …` plus CRC16-XModem, zone bit 0x0000, see the
`setup_induction.py` script).
