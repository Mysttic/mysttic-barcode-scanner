# Scanning configuration and profiles

The configurator's user interface is in Polish; the Polish labels are given in
brackets below, in the order they appear on screen.

## Connecting to the configurator

1. Open **`configurator.html`** from the scanner's disk in Chrome or Edge. The
   copy from the release package or from the repository works the same way.
2. Click **Połącz** (Connect) and pick the "USB serial device" port:
   - production firmware (C): there is **one** port,
   - prototype firmware (CircuitPython): pick the **second** of the two (the
     first is the console, so a timeout on connecting means you should switch to
     the other one).
3. The header shows the firmware version and the operating mode, and a tab bar
   appears below it: **Urządzenie · Profile · Test · Aktualizacja · Serwis**
   (Device, Profiles, Test, Update, Service).

The **Zastosuj** (Apply) and **Zapisz trwale** (Save permanently) buttons are
always visible on the right of the tab bar and cover the whole configuration,
from every tab at once:

- **Zastosuj** sends the configuration to RAM. It takes effect immediately and
  disappears when the device loses power. For quick experiments.
- **Zapisz trwale** stores the configuration in the scanner's memory. It survives
  restarts and firmware updates.

## The "Urządzenie" (Device) tab

![The Device tab](img/configurator-device.png)

Global settings that apply regardless of profiles:

| Setting | Meaning |
|---|---|
| Opóźnienie klawiszy (ms) — key delay | pause between characters; raise it when an application drops characters |
| Klawisz kończący (bez profilu) — terminating key | what to press after a code with no profile; usually ENTER |
| Tryb bez profilu — no-profile mode | what to do with a code matching no profile: type it verbatim, or split it (`splitAt`) |
| Podział po znaku nr — split position | where to cut in "split" mode (code → part 1, TAB, part 2) |
| Pauza po TAB/ENTER (ms) | extra time for focus to move in slow applications |
| Blokada duplikatów (ms) — duplicate blocking | the same code within this window is typed once (0 disables it) |
| Prefiks / sufiks tekstowy | fixed text glued before or after the code (no-profile mode) |
| Gdy profil nie sparsuje kodu | when a profile fails to parse: send it raw, or drop the scan |

The screenshot shows the factory settings: 10 ms between characters, 30 ms after
TAB and ENTER, duplicate blocking at 1.5 s, and codes without a profile typed
verbatim and finished with ENTER.

## The "Profile" (Profiles) tab — the heart of the device

![The Profiles tab](img/configurator-profiles.png)

A profile says **which codes to catch** (detection), **how to cut them into
fields** (parsing) and **what to type** (the action sequence). Codes matching no
enabled profile are typed verbatim.

**Out of the factory, every profile is disabled**, so the scanner types codes
verbatim until you enable one. The screenshot shows the state after enabling the
two production profiles, which is what the test scenario in
[TESTING.md](TESTING.md) asks for:

- **gs1-datamatrix** (enabled here) catches codes starting with AI `01` (with an
  optional `]d2` symbology identifier), parses them with the built-in GS1 parser
  and types `{gtin} TAB {dataWaznosciISO}`,
- **pracownik-tab** (enabled here) catches `PRC;…` codes, cuts them on semicolons
  with a group regex into the fields `imie, nazwisko, numer, dzial` and fills the
  form with TABs,
- **lek-wtyczka** (disabled) is the medicine-order variant: it parses the same
  GS1 codes but types a `LEK;…` frame instead of TABs. It collides with
  `gs1-datamatrix`, so only one of the two can be enabled at a time,
- **demo-prefiks-P** (disabled) is a template example. Disabled profiles stay in
  the configuration but do nothing.

Profile fields:

- **włączony** (enabled): the profile only works with the checkbox ticked,
- **Wykrywanie (regex)** (detection): a pattern matched against the start of the
  code, `^PRC;` for example,
- **Typ parsowania** (parsing type):
  - *regex z grupami* (regex with groups): a pattern with parentheses, such as
    `^PRC;([^;]+);([^;]+);([^;]+);([^;]+)$`, plus a **Pola** (fields) map:
    `imie=1, nazwisko=2, numer=3, dzial=4`,
  - *GS1 (AI 01/17/10/21)*: the built-in GS1 parser, with fixed fields
    `{gtin} {dataWaznosci} {dataWaznosciISO} {partia} {numerSeryjny}` (a hint
    listing them appears under the sequence),
- **Sekwencja akcji** (action sequence): what the scanner will type,
  - `{field}` types the value of a field,
  - `"text"` types fixed text,
  - `TAB ENTER ESC BACKSPACE UP DOWN LEFT RIGHT F1`-`F12` press a key.

Example sequences:

```
{imie} TAB {nazwisko} TAB {numer} TAB {dzial} ENTER
{gtin} TAB {dataWaznosciISO} TAB {partia} TAB {numerSeryjny} ENTER
{numer} TAB TAB ENTER TAB {imie} " " {nazwisko}
```

**+ Dodaj profil** (Add profile) creates an empty card; **Usuń** (Delete) removes
one. Changes only take effect on "Zastosuj" or "Zapisz trwale", so a mistake can
be undone with "Odśwież z urządzenia" (Reload from device) on the Service tab.

A note on patterns: the on-device engine supports `^ $ . [] * + ? ()` and the
classes `\d \w \s`. Spell `{m,n}` quantifiers out (`[0-9][0-9][0-9]`); the
configurator enforces this on save.

## The "Test" tab

![The Test tab](img/configurator-test.png)

Tick **Tryb testowy** (test mode) and scan. Every scan appears in the log window
(raw content, matched profile, parsed fields) and **nothing is typed into any
window**, which is ideal for tuning profiles without damaging documents. Untick
it when you are done (it also switches itself off on disconnect).

### Test pages for live trials

To check the full path (scan → keyboard → form) there are ready-made pages in
the repository's [`test-vectors/`](../test-vectors/) directory. Open a file in a
browser, click the first field and scan the code printed or displayed on the same
page:

| Page | What it tests | Profile |
|---|---|---|
| [`form-a-tab.html`](../test-vectors/forms/form-a-tab.html) | a form filled in order with TABs | **pracownik-tab** |
| [`form-b-names.html`](../test-vectors/forms/form-b-names.html) | fields in a different order, so the sequence has to match the form's layout | **pracownik-tab** (with a modified sequence) |
| [`form-gs1.html`](../test-vectors/forms/form-gs1.html) | a pharmacy GS1 DataMatrix: GTIN, expiry date, batch, serial number | **gs1-datamatrix** |

Every page carries its own QR code to scan and a description of the expected
result. The full acceptance scenario: [TESTING.md](TESTING.md).

## The "Aktualizacja" (Update) tab

![The Update tab](img/configurator-update.png)

Shows the installed firmware version with a link to the releases (and the
changelog) plus a condensed update procedure. The **Restart do bootloadera**
button puts the scanner into `RPI-RP2` disk mode without reaching for the BOOT
button on the board. Full instructions: [INSTALL.md](INSTALL.md).

## The "Serwis" (Service) tab

![The Service tab](img/configurator-service.png)

- **Odśwież z urządzenia** (Reload from device) discards the changes in the form
  and reads the scanner's current configuration,
- **Eksport / Import JSON** for backups and for moving a configuration between
  devices (provisioning),
- the red zone:
  - **Ustawienia fabryczne** (Factory settings) clears the permanent copy, so the
    configuration falls back to the file or to the factory defaults,
  - **Restart** is a plain reboot of the scanner,
  - **Restart do bootloadera (UF2)** is the same as on the Update tab.

## Where configuration is stored, and what wins

Configuration sources in order of precedence: **the permanent copy → the
`config/config.json` file on the disk → factory settings**. Editing the file
makes sense when provisioning many devices; after the first "Zapisz trwale" the
permanent copy wins, until "Ustawienia fabryczne".

## Factory settings (in hardware)

When the configurator is unavailable: hold the button wired to GP2 for about a
second while plugging in USB.

## Configuring the scanner module (once)

The module's own modes (UART output, scanning on presentation) are set with codes
from the module's manual (see [HARDWARE.md](HARDWARE.md) for where to get it).
Details in [INSTALL.md](INSTALL.md), section 3.
