# Mysttic Barcode Scanner — installation and setup

Once installed, the device behaves like an ordinary USB keyboard: plug it into
any computer, present a code, and the text is typed into the active window.
Profiles let it split codes into fields and interleave them with TAB and ENTER,
and the whole configuration is done from a web page served off the scanner's own
disk, without installing anything.

## What you need

- an **RP2040 board with native USB** (Raspberry Pi Pico or a clone such as
  the YD-RP2040),
- a 1D/2D scanner module with a TTL UART and four wires (we use a
  **Waveshare 14810**; GM65 and GM805 work the same),
- a USB cable **with data lines**,
- a computer with **Chrome or Edge** for the configurator (the prototype
  installer additionally needs Windows),
- the release package `mysttic-barcode-scanner-vX.Y.Z.zip` from GitHub Releases.

Hardware choices and the modules we have actually tested: [HARDWARE.md](HARDWARE.md).

## 1. Wiring the scanner module to the board

Pin order on our module's connector (Waveshare 14810): `VCC | TXD | RXD | GND`.
Other modules order them differently, so read the silkscreen on yours; the
mapping below is by pin name, not by position.

| Module pin | RP2040 board pin |
|---|---|
| VCC | 5 V (VBUS / Vin / Vout, the 5 V pin next to USB) |
| TXD | **GP1** (physical pin 2) |
| RXD | **GP0** (physical pin 1) |
| GND | GND |

Rules: wire it up with USB unplugged, ground first; UART always crosses over
(TXD to GP1, RXD to GP0). **Do not go by the colours of the factory harness**,
they are arbitrary. Look at the pin labels. The module needs 5 V power but
signals at 3.3 V, which is safe for the RP2040. If you use a module other than
the Waveshare 14810, confirm its TX level in its own datasheet.

## 2. Installing the software

What is inside the release package:

```
firmware/mysttic_barcode_scanner.uf2   PRODUCTION FIRMWARE - this is what you flash
browser-extension/            browser extension (form-filling variant C)
desktop-agent/                agent for Windows applications (variant D, optional)
configurator.html             a copy of the configurator (the same one is on the device)
INSTALL.md, BROWSER-EXTENSION.md, LEARNING-PROFILES.md, DESKTOP-AGENT.md
circuitpython-prototype/      development prototype (optional)
SHA256SUMS.txt                checksums
```

A second asset is published next to it, `demo-app-v<version>-win-x64.zip`, a
portable application for practising with the desktop agent.

**Production install (any operating system), one step:**

1. Enter the bootloader: hold **BOOT** on the board and press **RST** (or plug
   in USB while holding BOOT). A disk named `RPI-RP2` appears.
2. Drag **`firmware/mysttic_barcode_scanner.uf2`** onto it. The board reboots by itself.
3. Done. The scanner shows up as a keyboard and exposes a disk called
   **`MYSTTIC`** containing the configurator, the manuals and test forms.

Nothing has to be copied onto the device: the configurator
(`configurator.html`), the manuals (`MANUAL.md`, `BROWSER-EXTENSION.md`,
`LEARNING-PROFILES.md`) and the tests (`tests.html` plus `forms/`) are built into
the firmware.

**Prototype variant (CircuitPython)**, for development work only, directory
`circuitpython-prototype/`: run `install.ps1` (Windows, right-click, *Run with
PowerShell*), or drag `flash/*.uf2` onto `RPI-RP2` by hand and copy the contents
of `device/` onto the `CIRCUITPY` disk. The differences between the variants are
described in [ARCHITECTURE.md](ARCHITECTURE.md).

**Browser extension** (needed only for filling forms by field name):
`chrome://extensions` → *Developer mode* → *Load unpacked* → the `browser-extension/`
directory. Details: [BROWSER-EXTENSION.md](BROWSER-EXTENSION.md).

**Desktop agent** (the same idea in Windows applications, an optional module):
directory `desktop-agent/`, right-click `install-agent.ps1` → *Run with
PowerShell*. Details: [DESKTOP-AGENT.md](DESKTOP-AGENT.md).

## 3. Setting up the scanner module (once, for a new module)

A brand-new module may be shipped with USB output enabled instead of UART. If
the scanner beeps on a read but nothing is typed:

1. Open the module's command manual (see [HARDWARE.md](HARDWARE.md) for where to get
   it, the page with output settings) and scan the **"Series Output"** code, and
   for good measure **"9600bps (Default)"** as well.
2. Trigger-free operation (reading as soon as a code is presented): scan the
   **"Induction Mode"** code, or connect the scanner and run `setup_induction.py`
   from this repository on the board. It sends the commands and stores the mode
   permanently in the scanner's EEPROM.

## 4. First test

Open a text editor, click into it and scan any EAN code. The text plus ENTER
should appear. Ten scans of the same code give ten identical lines.

After installation the scanner's disk (**`MYSTTIC`**, read-only) contains
`configurator.html`, `tests.html` plus `forms/` (the full test set), `MANUAL.md`,
`BROWSER-EXTENSION.md` and `LEARNING-PROFILES.md`. In the prototype variant (the
`CIRCUITPY` disk) there is additionally `config/config.json`, which can be
edited, and the firmware files `*.py` and `lib/`, which should be left alone.

## 5. The configurator (profiles)

1. Open **`configurator.html`** from the scanner's disk in Chrome or Edge
   (production C firmware: the read-only **`MYSTTIC`** disk; CircuitPython
   prototype: the `CIRCUITPY` disk).
2. Click **Połącz** (Connect) and pick the **second** "USB serial device" port.
   The first one is the diagnostic console; if you pick it you get a timeout, so
   disconnect and choose the other one.
3. The **Urządzenie** (Device) tab: key delays, the pause after TAB and ENTER
   for slow applications, duplicate blocking, prefix and suffix.
4. The **Profile** (Profiles) tab is the heart of the device. A profile is
   detection (a regular expression) plus parsing (a regular expression with
   groups, or **GS1**) plus a sequence of actions, for example
   `{imie} TAB TAB ENTER {nazwisko}` or `{gtin} TAB {dataWaznosciISO} ENTER`.
   Codes that match no profile are typed through verbatim.
5. The **Test** tab (test mode): scans are shown on the page, raw and split into
   fields, and nothing is typed into any window. This is the place to tune
   profiles.
6. **Zastosuj (RAM)** (Apply) lasts until the device is unplugged; **Zapisz
   trwale (NVM)** (Save permanently) writes to the board's flash. Both buttons
   sit next to the tab bar.

Annotated screenshots of every tab: [CONFIGURATION.md](CONFIGURATION.md).

Note: regular expressions run on the device in a cut-down engine. The `{m,n}`
quantifier is not supported (the configurator catches this), so spell patterns
out, for example `[0-9][0-9]`.

## 6. Updating the firmware

1. Download the new release package and verify the SHA-256 sums
   (`SHA256SUMS.txt`).
2. In the configurator: the **Aktualizacja** (Update) tab → **Restart do
   bootloadera** (Reboot to bootloader), or use BOOT+RST by hand.
3. Continue as with the installation. The prototype installer detects an
   existing `CIRCUITPY` and replaces only the files; flash a new UF2 only when
   the release says so.

User configuration lives in the board's flash and **survives an update**. To
restore factory settings use the button in the configurator, or hold the button
on GP2 for about a second while plugging in USB.

## Common problems

| Symptom | Cause and fix |
|---|---|
| the scanner beeps but nothing is typed | the module's output is set to USB, scan "Series Output" (step 3); or TXD/RXD are not crossed over |
| garbage characters or stray `\x00` | wrong baud rate, scan "9600bps (Default)" |
| everything is typed twice | you are holding the code in front of the lens; use duplicate blocking in the configurator (1.5 s by default) |
| the application drops characters, or TAB does nothing | increase "key delay" and "pause after TAB/ENTER". Note that fields with autocomplete can swallow TAB |
| configurator: timeout after connecting | you picked the first port (the console), disconnect and choose the second |
| the device loops on an error after a config change | not possible with correct firmware (validation plus fallback), and a factory reset with the GP2 button at power-on always works |
