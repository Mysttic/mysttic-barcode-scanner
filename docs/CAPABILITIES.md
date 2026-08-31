# Capabilities and limits

State as of 2026-08-21 (C firmware, configurator and extension, after stages
0-12). Three categories: **verified on hardware** (the strongest guarantee),
**verified automatically** (tests in CI), and **limits** (what we do not do, and
what happens when you try).

## What it does — verified on hardware

| Feature | How it was checked |
|---|---|
| plug-and-play USB keyboard, works in any application with nothing installed | E2/E11 on hardware; httpbin.org (a real third-party page) |
| scanning on presentation (the module's induction mode, no trigger) | the module's EEPROM configured over UART commands, E4 |
| profiles in the scanner: regex detection → splitting into fields → the sequence `{field} TAB "text" ENTER` | forms A and GS1 on hardware, 10 of 10 scans |
| the GS1 parser in the scanner: AI 01/17/10/21, the GS separator from UART, day "00" meaning end of month, AIM `]d2` | a DataMatrix FMD scan off the screen filled the form with an ISO date |
| verbatim typing of codes with no profile, plus the terminating key | EAN-13 passthrough on hardware |
| duplicate blocking (induction mode re-reads about once a second) | holding a code in front of the lens types it once |
| permanent configuration storage: atomic A/B slots, surviving a restart, a firmware update and (incidentally) a CircuitPython installation | E11 plus many reflashes during development |
| the Web Serial configurator from the device disk (`file://`) and from a file: tabs, test mode, JSON import and export | owner tests E7-E12 |
| the `MYSTTIC` disk (read-only MSC): configurator, manuals and test forms with a subdirectory | mounted and byte-for-byte identical after every flash |
| the extension: filling by field name on recognised pages, including capturing a TAB sequence from a production scanner profile | an owner test on hardware (the employee and medicine C forms) |
| the desktop agent: filling forms in Windows applications (optional module) | 34 unit assertions and 27 e2e ones against a live application; a full run against the files from a release package |
| a 3 s watchdog, factory reset from the GP2 button | E11 |
| firmware update: `rebootBootloader` then UF2, with the configuration untouched | many times during this work |

## What it does — verified automatically (CI)

- the same parsing vectors in three implementations: CircuitPython (52
  assertions), C (87), the extension (96 unit and 22 e2e in a real Chromium),
- the extension's e2e test simulates the keyboard like a real HID device
  (separate Shift events, TABs in a series), which covers the regression found in
  the first hardware test,
- cross-rejection of frames (a medicine code will not fill an employee form),
- handing an unrecognised frame back to the page (no regression of variant A),
- the UF2 build and the release package in CI.

## Which codes are supported

**Symbologies (decoded by the scanner module):** the full list is in the manufacturer's
manual (see [HARDWARE.md](HARDWARE.md)). **Physically tested by us**: EAN-13, QR
(text frames), DataMatrix ECC200 (GS1 with a GS separator, scanned both off a
screen and off a printout).

**Logical formats (the profile layer):**

| Format | Support | Notes |
|---|---|---|
| any ASCII text | yes, passthrough or `parse.regexGroups` | printable characters; frames up to about 6 KB |
| frames with separators (`PRC;…`, `EMP;…`) | yes, verified | a group regex in the scanner, or splitting in the extension |
| GS1: AI **01** (GTIN-14), **17** (date, day 00 becomes end of month), **10** (batch, up to 20), **21** (serial, up to 20) | yes, verified (the FMD / pharmacy format) | any AI order, GS handled, AIM `]d2` stripped |
| GS1: the other AIs (`30`, `11`, `15`, `240`, `710-714`…) | no, deliberately | such an AI is a parse error, so the behaviour follows `onError` (verbatim or skip); the extension rejects the frame (fail-safe), see [ROADMAP.md](ROADMAP.md) |
| Russian cryptographic codes (AI 91-93) | no | a different ecosystem; same safe fallback as above |
| the German PPN (IFA, the `[)>…06…` envelope) | no | not GS1, so detection does not match it and it passes through |

## What it does not do (hard limits), and what happens then

| Limit | Why | What the system does |
|---|---|---|
| non-ASCII characters (Polish diacritics) in the HID output | a US keyboard layout, and barcodes are ASCII | non-printable and non-ASCII characters are filtered out |
| the GS separator over the keyboard | HID only carries printable characters | field boundaries come from the scanner profile's sequence |
| a code with an unknown AI, or one a profile fails to parse | the parser does not guess field boundaries | per configuration: verbatim **or** skip; the extension rejects it and hands it back to the page with a "Nierozpoznany kod" toast, and **never writes into the wrong fields** |
| filling by field name in desktop applications | the extension lives in a browser | the **desktop agent** (an optional module, [DESKTOP-AGENT.md](DESKTOP-AGENT.md)); without it variant A (TABs) works everywhere |
| applications with no accessibility support (Citrix/RDP, hand-drawn interfaces) | no control tree to address | the agent falls back to window-relative coordinates, or TABs remain |
| a closed Shadow DOM, and `password` fields | selectors cannot reach it / deliberate | the extension skips them; passwords are never filled |
| the configurator outside Chrome and Edge | Web Serial is Chromium-only | configure from another workstation; the scanner itself is unaffected |
| workstations that block USB storage (corporate policy) | MSC may be blocked | the keyboard and CDC still work; take the configurator and manuals from the release package |
| the extension on `file://` without permission | a Chrome requirement | tick "Allow access to file URLs" once |

## Parametric limits (variant C)

| Parameter | Limit |
|---|---|
| profiles / fields / actions per profile | 6 / 8 / 16 |
| configuration size (JSON) | 4 KB |
| a CDC protocol line | 6 KB |
| the `MYSTTIC` disk image | 256 KB (about 130 KB free) |
| regex patterns | the subset `^ $ . [] * + ? ()` plus `\d \w \s`; no `{m,n}` and no `\|` |
| an extension frame | a TAB or a character separator; without a prefix the segment count has to match exactly |

## Known differences of variant C against the CircuitPython prototype

- the test-mode event does not return the profile name or the fields, only the
  raw data,
- the firmware version in the repository is `0.0.0-dev` (it is injected from
  VERSION.md, see the roadmap),
- USB VID/PID `1209:0001` is the pid.codes **test** identifier: fine for building
  your own unit, but a product placed on the market needs its own PID.
