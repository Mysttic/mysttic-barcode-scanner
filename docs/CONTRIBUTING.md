# Contributing

Bug reports, hardware notes, profiles for real-world forms and pull requests are
all welcome.

- [A note on language](#a-note-on-language)
- [Repository layout](#repository-layout)
- [Building from source](#building-from-source)
- [Running the tests](#running-the-tests)
- [The out-of-the-box test](#out-of-the-box-test)
- [Verifying a published release](#verifying-a-published-release)
- [Documentation images](#documentation-images)
- [Pull requests and releases](#pull-requests-and-releases)

## A note on language

Documentation is in English. **Source code, code comments and the user interfaces
are in Polish** (identifiers like `Nagrywarka`, `OknoNauki`, `Krok.Tryb`). That is
a deliberate, historical choice: keep new code consistent with the file you are
editing rather than mixing two languages inside one module. Translating the
interfaces is on the [roadmap](roadmap.md) and will be one coordinated change,
not a file-by-file drift.

## Repository layout

| Directory | What lives there |
|---|---|
| `firmware-pico-sdk/` | production firmware in C (Pico SDK, TinyUSB, CDC + HID + MSC) |
| `firmware-circuitpython/` | the original CircuitPython prototype, kept for reference |
| `configurator/` | configuration web page (TypeScript, Vite, built into a single HTML file) |
| `browser-extension/` | Chrome and Edge extension (MV3) |
| `desktop-agent/` | optional Windows agent (.NET 9, WinForms, UI Automation) plus a demo application |
| `tools/` | release packaging, the FAT12 disk image generator, host-side helpers |
| `test-vectors/` | test forms and codes, used by the tests and by the device disk |
| `hardware/` | the Wokwi schematic and pinned installer files |
| `brand/` | logo and icon sources plus the scripts that rasterise them |

How the parts fit together: [Architecture](architecture.md).

## Building from source

Prerequisites: Python 3.12+, Node 22+, CMake, Ninja, `arm-none-eabi-gcc`, and
.NET SDK 9 for the desktop agent.

```bash
# 1. configurator - must exist before the firmware, it is embedded in the disk image
cd configurator && npm ci && npm run build && cd ..
```

```bash
# 2. production firmware -> firmware-pico-sdk/build/mysttic_barcode_scanner.uf2
cd firmware-pico-sdk
cmake -G Ninja -B build -DCMAKE_BUILD_TYPE=Release -DPICO_SDK_PATH=$HOME/pico-sdk
ninja -C build
```

```bash
# 3. desktop agent (Windows at runtime; builds on Linux thanks to EnableWindowsTargeting)
dotnet publish desktop-agent/src/CzytnikAgent -c Release -r win-x64 --self-contained true -p:EnableWindowsTargeting=true -o publish/agent
```

```bash
# 4. the full release package (firmware, extension, agent, docs)
python tools/build_release.py
```

## Running the tests

Everything except the agent's e2e test runs in CI on every pull request to
`master`.

```bash
python firmware-circuitpython/tests/test_firmware.py    # 52 assertions, no hardware
```

```bash
cd firmware-pico-sdk && gcc -Wall -Wextra -Werror -I src tests/test_host.c src/scan_framer.c src/parser_gs1.c src/mini_regex.c src/config_parse.c src/profile_matcher.c -o test_host && ./test_host
```

```bash
cd browser-extension && npm ci && npm test && npm run test:e2e   # 96 unit + 22 e2e in real Chromium
```

```bash
dotnet run -c Release --project desktop-agent/tests/TestyAgenta  # 34 agent unit assertions (Windows)
```

```bash
python desktop-agent/tests/test_e2e.py    # 27 assertions against a live app (Windows)
```

The agent's e2e test drives the real mouse and keyboard, so do not use the
machine while it runs; that is why it is not in CI.

The same parsing vectors exist in three implementations (CircuitPython, C, the
extension) plus the agent. **Any change to parsing logic gets the same vector
everywhere** — that rule is what keeps the four parsers in agreement.

With hardware connected there is also a semi-automatic scenario:

```bash
python tools/test_e2e.py
```

It finds the device by itself and goes through detection, reading the
configuration, a change with a read-back, a permanent save with a restart and a
persistence check, test mode, typing over the keyboard and duplicate blocking. It
ends with a PASS/FAIL report and restores the previous configuration.

## Out-of-the-box test

The manual acceptance walkthrough, done entirely from the scanner's own disk. The
device keeps one production configuration throughout; nothing is switched between
tests.

Preparation: plug the scanner in, open `configurator.html` from the `MYSTTIC`
disk, connect, tick `pracownik-tab` and `gs1-datamatrix` on the **Profile** tab
and click **Zapisz trwale** (every profile is disabled out of the factory).
Install the extension (`chrome://extensions` → Developer mode → Load unpacked →
`browser-extension/`) and enable "Allow access to file URLs". Then open
`tests.html` from the disk.

| # | Test | Expected result |
|---|---|---|
| 1 | form A, click "Imię", scan | fields filled in order (JAN/KOWALSKI/12345/IT), Enter submits |
| 2 | form B, click nothing, scan | values land by name despite the shuffled order; decoy fields stay empty |
| 3 | GS1 form, click the first field, scan | GTIN, date `YYYY-MM-DD`, batch, serial, in order |
| 4 | form C (employee card), scan without clicking | same data as test 1, but filled BY NAME; the page-state panel shows 4/4 |
| 5 | form C, *Ustawienia* view, click a field, scan | badge goes out, TABs behave like an ordinary keyboard |
| 6 | form C (medicine), scan the DataMatrix | serial `K7L9XW24MQ1R`, date `2027-10-31` (from `271000`), GTIN and batch, by name |
| 7 | back on test 4, scan the MEDICINE code | nothing is filled: profiles do not fire across pages |

Before a production rollout it is worth adding: 100 consecutive scans without a
reset, a power loss during "Zapisz trwale", the target USB cable, TAB and ENTER
timing in the real application, GS1 codes with the AIs in different orders, and
learning mode on the customer's own form.

## Verifying a published release

The automated tests can run against **the files from a downloaded package**
rather than local builds, which checks exactly what a user gets:

```bash
sha256sum -c mysttic-barcode-scanner-v<version>.zip.sha256
cd mysttic-barcode-scanner-v<version> && sha256sum -c SHA256SUMS.txt
```

```bash
AGENT_EXE=.../desktop-agent/MystticBarcodeAgent.exe \
APLIKACJA_EXE=.../demo-app-v<version>/MystticDemoApp.exe \
PROFIL_TESTOWY=.../desktop-agent/example-profile.json \
python desktop-agent/tests/test_e2e.py
```

```bash
cd browser-extension && EXT_DIR=.../browser-extension node tests/test_e2e.mjs
```

## Documentation images

Screenshots in `docs/img/` are generated, never edited by hand. If your change
alters a user interface, refresh the affected set:

```bash
cd browser-extension && npm run shots      # extension-*.png
```

```bash
node configurator/tests/screenshots.mjs    # configurator-*.png, against a stub device
```

```bash
MystticBarcodeAgent.exe --zrzuty docs/img --proces MystticDemoApp   # agent-*.png
```

```bash
node hardware/wokwi/render-diagram.mjs     # wiring-minimal.png, from the saved Wokwi project
```

Details, including how to rework the wiring diagram and the brand assets:
[Images and brand assets](img/README.md).

## Pull requests and releases

- Branch off `develop`; `master` only ever receives merges from `develop`.
- CI must be green: firmware build, host tests, extension unit and e2e, agent
  unit tests, and a cross-build of the agent executables.
- **Do not bump `VERSION.md` in an ordinary pull request.** A release happens when
  `VERSION.md` changes on `master`, so it belongs in a dedicated release PR
  together with the `CHANGELOG.md` entry. After the merge, CI builds the package,
  creates the tag and publishes the release by itself.
- Keep commit messages in the style already in the history: a short imperative
  summary, then why the change was needed.

When reporting a hardware problem, include the scanner module model, how it is
wired, the firmware version (visible in the configurator) and, for a decoding
problem, a photo of the code. The modules we have actually tested are listed in
[Getting started](getting-started.md).

Participation is governed by the [code of conduct](CODE_OF_CONDUCT.md).
