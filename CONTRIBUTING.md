# Contributing

Thanks for taking the time. Bug reports, hardware notes, profiles for real-world
forms and pull requests are all welcome.

## A note on language

Documentation is in English. **Source code, code comments and the user interface
are in Polish** (identifiers like `Nagrywarka`, `OknoNauki`, `Krok.Tryb`). That
is a deliberate, historical choice of this project: keep new code consistent with
the file you are editing rather than mixing two languages inside one module.
Translating the UI is on the roadmap and will be done as one coordinated change,
not file by file.

## Repository layout

| Directory | What lives there |
|---|---|
| `firmware-pico-sdk/` | production firmware in C (Pico SDK, TinyUSB, CDC + HID + MSC) |
| `firmware-circuitpython/` | the original CircuitPython prototype, kept for reference |
| `configurator/` | configuration web page (TypeScript, Vite, built into a single HTML file) |
| `browser-extension/` | Chrome/Edge extension (MV3) |
| `desktop-agent/` | optional Windows agent (.NET 9, WinForms, UI Automation) + a demo app |
| `tools/` | release packaging, FAT12 disk image generator, host-side helpers |
| `test-vectors/` | test forms and codes used by tests and by the device disk |
| `brand/` | logo, icon sources and the scripts that rasterise them |

## Building from source

Prerequisites: Python 3.12+, Node 22+, CMake, Ninja, `arm-none-eabi-gcc`,
.NET SDK 9 (only for the desktop agent).

```bash
# 1. configurator (must exist before the firmware: it is embedded in the disk image)
cd configurator && npm ci && npm run build && cd ..
```

```bash
# 2. production firmware -> firmware-pico-sdk/build/mysttic_barcode_scanner.uf2
cd firmware-pico-sdk
cmake -G Ninja -B build -DCMAKE_BUILD_TYPE=Release -DPICO_SDK_PATH=$HOME/pico-sdk
ninja -C build
```

```bash
# 3. desktop agent (Windows only at runtime; builds fine on Linux thanks to EnableWindowsTargeting)
dotnet publish desktop-agent/src/CzytnikAgent -c Release -r win-x64 --self-contained true -p:EnableWindowsTargeting=true -o publish/agent
```

```bash
# 4. full release package (firmware + extension + agent + docs)
python tools/build_release.py
```

## Running the tests

```bash
python firmware-circuitpython/tests/test_firmware.py            # 52 assertions, no hardware
```

```bash
cd firmware-pico-sdk && gcc -Wall -Wextra -Werror -I src tests/test_host.c src/scan_framer.c src/parser_gs1.c src/mini_regex.c src/config_parse.c src/profile_matcher.c -o test_host && ./test_host
```

```bash
cd browser-extension && npm ci && npm test && npm run test:e2e     # unit + Chromium with the extension loaded
```

```bash
dotnet run -c Release --project desktop-agent/tests/TestyAgenta   # agent unit tests (Windows)
```

```bash
python desktop-agent/tests/test_e2e.py     # agent e2e: real windows, real UI Automation (Windows, takes over the mouse)
```

The agent's e2e test drives the real mouse and keyboard, so do not use the
machine while it runs. It is deliberately not part of CI.

More, including how to verify a published release package:
[docs/TESTING.md](docs/TESTING.md).

## Documentation images

Screenshots in `docs/img/` are generated, never edited by hand. If your change
alters a user interface, refresh the affected set:

```bash
cd browser-extension && npm run shots      # extension-*.png
```

```bash
node configurator/tests/screenshots.mjs    # configurator-*.png (no hardware needed)
```

```bash
MystticBarcodeAgent.exe --zrzuty docs/img --proces MystticDemoApp   # agent-*.png
```

```bash
node hardware/wokwi/render-diagram.mjs     # wiring-minimal.png, from the saved Wokwi project
```

Details, plus how to rework the wiring diagram and the brand assets:
[docs/img/README.md](docs/img/README.md).

## Pull requests

- branch off `develop`; `master` only ever receives merges from `develop`,
- CI must be green (firmware, host tests, extension unit + e2e, agent unit,
  cross-build of the agent executables),
- do not bump `VERSION.md` in an ordinary pull request. A release happens when
  `VERSION.md` changes on `master`, and it should change in a dedicated release
  PR together with the `CHANGELOG.md` entry,
- keep commit messages in the style already present in the history: a short
  imperative summary, then why the change was needed.

## Reporting hardware problems

Include the scanner module model, how it is wired, the firmware version (visible
in the configurator and in `version.py` / the USB descriptor) and, if the problem
is with decoding, a photo of the code. See [docs/HARDWARE.md](docs/HARDWARE.md)
for the modules we have actually tested.

## Code of conduct

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
