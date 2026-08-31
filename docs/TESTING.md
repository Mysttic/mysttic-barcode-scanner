# Testing

Four levels: the out-of-the-box scenario (manual, from the scanner's disk), unit
tests (automated), an e2e scenario on hardware (semi-automated) and an acceptance
test plan (a checklist before deployment).

The user interfaces are in Polish, so Polish labels appear in brackets below.

## 0. Out of the box — the full test from the scanner's disk

Everything needed is inside the scanner. The device configuration stays the same
(the production one) throughout the whole scenario; nothing is switched between
tests.

**Preparation (once):**

1. Plug the scanner into USB. A disk named **`MYSTTIC`** appears.
2. Open `configurator.html` from the disk (Chrome or Edge) → **Połącz**
   (Connect) → the **Profile** tab: tick `pracownik-tab` and `gs1-datamatrix`,
   then click **Zapisz trwale** and disconnect. Every profile is disabled out of
   the factory, so this step is what turns the scenario on.
3. Install the extension: `chrome://extensions` → **Developer mode** → **Load
   unpacked** → the `browser-extension/` directory from the repository or the
   release package. In the extension's **Details**, enable **"Allow access to
   file URLs"** (the test pages open from the disk).
4. Open **`tests.html`** from the disk. That is the menu for the whole scenario.

**The tests, in order, scanning the codes straight off the screen:**

| # | Test | Steps | Expected result |
|---|---|---|---|
| 1 | **A — TABs** | open form A, click the "Imię" field, scan | fields filled IN ORDER (JAN/KOWALSKI/12345/IT), Enter submits |
| 2 | **B — fields by name** | open form B, click nothing, scan | values land by name despite the shuffled order; decoy fields stay empty |
| 3 | **GS1 — TABs** | open the GS1 form, click the first field, scan | GTIN, date `YYYY-MM-DD`, batch, serial number, in order |
| 4 | **C — employee card (extension)** | open it, check for the "Czytnik: Karta pracownika (demo)" toast and the `ON` badge, scan WITHOUT clicking | the same data as in test 1, but the fields are shuffled and get filled BY NAME; the "stan strony" panel shows 4/4 |
| 5 | **C — negative** | on the page from test 4 switch to the *Ustawienia* view, click a field, scan | the badge goes out and the TABs behave like an ordinary keyboard (as if the extension were not installed) |
| 6 | **C — medicine order** | open it, check for the "Czytnik: Zamówienie leku (demo)" toast, scan the DataMatrix | serial number `K7L9XW24MQ1R`, date `2027-10-31` (from `271000`, day 00 meaning end of month), GTIN and batch, all by name; decoy fields empty |
| 7 | **profile switching** | go back to the page from test 4 and scan the MEDICINE code | nothing is filled (the frame is rejected): profiles do not fire across pages |

Pass criterion: tests 1-7 match the table. Optionally, next: learning mode on a
third-party page from the range ([FORMS.md](FORMS.md), section "A range"), with
the procedure in [BROWSER-EXTENSION.md](BROWSER-EXTENSION.md).

## 1. Unit tests (no hardware)

They run automatically in CI on every pull request to `master`
(`.github/workflows/ci.yml`). Locally:

```bash
cd firmware-circuitpython && python tests/test_firmware.py
```

```bash
cd firmware-pico-sdk && gcc -Wall -Wextra -Werror -I src tests/test_host.c src/scan_framer.c src/parser_gs1.c src/mini_regex.c src/config_parse.c src/profile_matcher.c -o test_host && ./test_host
```

```bash
cd browser-extension && npm ci && npm test
```

Scope: UART framing, the parser and profiles (regex and GS1), configuration
validation, NVM storage and the CDC protocol, with the same vectors in the Python
and C versions; for the extension also address matching and value
transformations.

### The extension's e2e test (Chromium, no hardware)

```bash
cd browser-extension && npm run test:e2e      # on a server: xvfb-run -a npm run test:e2e
```

It starts a real Chromium with the extension loaded, opens
`test-vectors/forms/form-c-extension.html` and simulates a scan with keyboard
events. It checks that a recognised form gets filled **and that the page really
sees the values** (not just `value`), that the extension stays silent on a view
with no profile, and that a foreign code is handed back to the page. It runs in
CI on every pull request too.

### Desktop agent tests (optional module)

```bash
dotnet run -c Release --project desktop-agent/tests/TestyAgenta
```

```bash
python desktop-agent/tests/test_e2e.py
```

The unit tests (34 assertions) exercise the parser on the same vectors as the
firmware and the extension, plus window matching and the processing of a
recording from learning mode. The e2e test (27 assertions) starts a **real
WinForms application** and real UI Automation: window recognition, filling fields
with verification against the application's own state, untouched decoy fields,
rejection of a foreign code, a scan captured by the agent in the background (also
in the style of a real reader, with Shift) and a new profile working without a
restart.

The agent's unit tests run in CI (the `agent-desktopowy` job, on Windows); the
e2e test needs a desktop with real windows, so it is run locally.

## 2. The e2e scenario on hardware

Plug the scanner in and run:

```bash
python tools/test_e2e.py
```

The script finds the device by itself (it works with both firmware variants) and
goes through seven steps: detection → reading the configuration → a change plus a
read-back → **a permanent save, a restart and a persistence check** → test mode
(the operator scans a code) → typing into a text editor over the keyboard (the
operator confirms) → duplicate blocking (the operator confirms). It ends with a
PASS/FAIL report and restores the device configuration to its previous state.

## 3. A test package before a release

The *Actions* tab → the `ci` workflow → **Run workflow** (branch `develop`). CI
runs the tests and builds the complete release zip as an artifact, without
publishing it. Install it on a test device (`install.ps1`) and go through the e2e
scenario before opening the release pull request.

## 3a. Verifying a published release

The tests from section 1 can be run against the files from a **downloaded
package** rather than local builds, which checks exactly what a customer gets.
After unpacking `mysttic-barcode-scanner-v<version>.zip` and
`demo-app-v<version>-win-x64.zip`:

```bash
# checksum of the package, and of the files inside it
sha256sum -c mysttic-barcode-scanner-v<version>.zip.sha256
cd mysttic-barcode-scanner-v<version> && sha256sum -c SHA256SUMS.txt
```

```bash
# the desktop agent from the package (27 assertions)
AGENT_EXE=.../desktop-agent/MystticBarcodeAgent.exe \
APLIKACJA_EXE=.../demo-app-v<version>/MystticDemoApp.exe \
PROFIL_TESTOWY=.../desktop-agent/example-profile.json \
python desktop-agent/tests/test_e2e.py
```

```bash
# the extension from the package (22 assertions)
cd browser-extension && EXT_DIR=.../browser-extension node tests/test_e2e.mjs
```

## 4. Acceptance test plan (before a production rollout)

Hardware:
- [ ] 100 consecutive scans with no reset and no lost characters
- [ ] unplugging and replugging USB requires no configuration
- [ ] the configuration survives a sudden power loss (including one during "Zapisz trwale")
- [ ] stable operation with the USB cable that will actually be used

Parsing and keyboard:
- [ ] a plain code is typed verbatim; profiles cut empty and long fields correctly
- [ ] TAB and ENTER work in the target application (with suitable pauses)
- [ ] a malformed code does not hang the device (onError as configured)
- [ ] duplicate blocking works while a code is held in front of the lens

GS1:
- [ ] AI 01/17/10/21 in various orders, with variable fields at the end and before a separator
- [ ] the GS separator (0x1D) is not lost; the day "00" rule is applied

Extension (if deployed):
- [ ] the profile activates on the target form and goes quiet after leaving it
- [ ] decoy fields stay empty; the form submits with a complete set of data
- [ ] on a page with no profile, a scan behaves as it did before installing the extension
- [ ] learning mode produces a working profile on the customer's form

Configurator:
- [ ] connects in Chrome and Edge; test mode types into no window
- [ ] an invalid configuration cannot be saved; import and export preserve profiles
- [ ] factory settings work (both the button and the GP2 hardware variant)

## The release process (a reminder)

`develop` → (optionally a test package plus e2e) → a pull request to `master` (CI:
tests) → merge → an automatic release, if the version in
[VERSION.md](../VERSION.md) was raised. Details:
[ARCHITECTURE.md](ARCHITECTURE.md).
