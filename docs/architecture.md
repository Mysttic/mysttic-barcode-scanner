# Architecture and technical details

## Hardware

- an **RP2040** board with native USB (Raspberry Pi Pico or a clone such as the
  YD-RP2040),
- a scanner module with a TTL UART (we use a **Waveshare 14810**; GM65 and
  GM805 behave the same), 3.3 V signalling on a 5 V supply, wired
  `TXD→GP1`, `RXD→GP0`, `VCC→VBUS`, `GND→GND`,
- optionally: a status LED (GP6), a service and factory-reset button (GP2), a
  buzzer (the module has its own). Extended prototype schematic:
  `hardware/wokwi/`. Where to buy the parts and which
  ones we have tested: [getting-started.md](getting-started.md).

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
in [browser-extension.md](browser-extension.md).

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

## Design decisions worth knowing

These are the choices that shape the whole thing, with the reasoning that still
applies. The rest of the history is in the commit log.

**The extension listens to the keyboard instead of talking to the device.** The
scanner *is* a keyboard, so a keyboard wedge needs zero firmware changes, does not
fight the configurator over the serial port and works with the factory
configuration. A structured channel over CDC would carry the GS separator and
remove the need for a hook, but it costs firmware work; it stays on the
[roadmap](roadmap.md) until the wedge proves too weak.

**Recognising a form means the address plus the presence of fields.** A URL alone
is not enough in a single-page app where several forms share one address. View
changes are tracked with a MutationObserver plus polling `location`; patching
`history.pushState` does not work, because a content script has its own JavaScript
context.

**Writing a value means firing native events.** `el.value = "X"` alone does
nothing in React, Vue or Angular: the framework keeps its own state and the form
submits empty despite the visible value. The extension uses the native setter plus
`input` and `change` events, then reads the value back. The demo forms show this
in a "page state" panel, and the e2e tests assert on that state rather than on
`value` — otherwise they would pass while the real form stayed empty.

**The device disk is read-only.** Configuration lives in flash and is reached over
the serial channel, so the disk carries tools only. There is nothing to break,
nothing to desynchronise, and formatting is rejected.

**Configuration is stored in atomic A/B slots, not a filesystem.** Two flash
sectors with a magic number, a sequence number and a CRC16; a write always goes to
the opposite slot and the newer valid one wins. An interrupted write cannot
destroy the previous configuration. LittleFS was considered and dropped: more code
for a weaker guarantee.

**The desktop agent targets controls, not coordinates.** Clicking remembered
points breaks on a moved window, a different resolution or DPI scaling. The agent
addresses controls through UI Automation and keeps coordinates only as a fallback;
learning records both at once. Every fill is verified by reading the value back.

**The agent records the operator's intent, not a guess.** A step stores whether
the operator *typed* text or *picked* a list item, because a search box with
suggestions looks like a drop-down list in the control tree and no heuristic gets
it right in both cases.

**Rejected, so they do not come back:** the bookmarklet as a production route
(unusable in practice, kept only for diagnostics), Web Serial in the extension
(firmware changes plus a port conflict), LittleFS (above), and a writable device
disk (above).

## Scanner module pinout and protocol

The module's manual is copyrighted by its manufacturer and is not redistributed here;
see [getting-started.md](getting-started.md) for where to obtain it. The module is configured
either with barcodes from that manual (UART output, induction mode) or over UART
commands (`7E 00 …` plus CRC16-XModem, zone bit 0x0000, see the
`setup_induction.py` script).
