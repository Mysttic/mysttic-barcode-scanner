# Getting started

What to buy, how to wire it, how to flash it, and how to check that it works.
Once installed, the device behaves like an ordinary USB keyboard: plug it in,
present a code, and the text is typed into the active window.

## 1. Parts

| Part | What we used | Notes |
|---|---|---|
| MCU board | **Raspberry Pi Pico** or a clone (YD-RP2040) | must be an RP2040 with **native USB**; boards with a USB-serial bridge will not work |
| Scanner module | **Waveshare 14810** (1D/2D, UART and USB output) | the unit everything here was built and tested against; GM65 and GM805 work the same way and take the same configuration barcodes |
| Cable | 4-wire harness, usually supplied with the module | JST on the module side |
| USB cable | any **data** cable | charge-only cables are the most common cause of "nothing happens" |
| Optional | a push button on GP2, an LED on GP6 | factory reset and status; the module has its own buzzer |

The scanner module is the expensive part and the one that decides which
symbologies you can read. Everything else is a commodity RP2040 board.

**Symbologies** are decoded inside the module, so its manual defines the full
list. The ones we have physically tested: EAN-13, QR (text frames) and DataMatrix
ECC200 (GS1 with a GS separator, both off a screen and off a printout). What the
profile layer then does with them: [Filling forms](filling-forms.md).

## 2. Wiring

Pin order on our module's connector, counting from pin 1: `VCC | TXD | RXD | GND`.
**Other modules order them differently** — some GM65 boards read
`GND | RXD | TXD | VCC` — so read the silkscreen on the board you actually have
instead of copying the picture.

| Module pin | RP2040 pin | Note |
|---|---|---|
| VCC | 5 V (VBUS, pin 40) | the module needs 5 V, not 3.3 V |
| TXD | **GP1** (pin 2) | UART crosses over |
| RXD | **GP0** (pin 1) | UART crosses over |
| GND | GND (pin 38, or any other GND) | connect ground first |

![Wiring: the RP2040 board and the scanner module](img/wiring-minimal.png)

Wire colours are arbitrary, both in the diagram and in the harness that comes in
the box. **Go by the pin labels.**

The easiest mistake here is swapping GND with a data line, or wiring TXD straight
to GP0. UART crosses over: the module's **TXD goes to GP1** (the Pico receives)
and its **RXD goes to GP0** (the Pico transmits); ground goes to a GND pin, never
to a GPIO.

The module powers from 5 V but signals at 3.3 V (measured on our unit), which is
safe to wire straight into the RP2040. Some datasheets for this family quote a
5 V TXD, and RP2040 GPIOs are not 5 V tolerant, so **measure TXD against GND on
your own module first**: an idle UART line sits at logic high, so a powered, idle
module should read about 3.3 V. If it reads 5 V, put a 1 kΩ / 2 kΩ divider on TXD.

A Wokwi simulation of the circuit, with a stand-in chip for the scanner, is in
`hardware/wokwi/` (see [Images and brand assets](img/README.md) for how the
diagram is rendered).

## 3. Flashing

Download `mysttic-barcode-scanner-vX.Y.Z.zip` from
[Releases](https://github.com/Mysttic/mysttic-barcode-scanner/releases). Inside:

```
firmware/mysttic_barcode_scanner.uf2   PRODUCTION FIRMWARE - this is what you flash
browser-extension/                     browser extension (form filling by field name)
desktop-agent/                         agent for Windows applications (optional)
configurator.html                      a copy of the configurator (the same one is on the device)
circuitpython-prototype/               development prototype (optional)
SHA256SUMS.txt                         checksums
```

A second asset, `demo-app-v<version>-win-x64.zip`, is a portable application for
practising with the desktop agent.

Installation is one step, on any operating system:

1. Enter the bootloader: hold **BOOT** on the board and press **RST** (or plug in
   USB while holding BOOT). A disk named `RPI-RP2` appears.
2. Drag **`firmware/mysttic_barcode_scanner.uf2`** onto it. The board reboots by
   itself.
3. Done. The scanner shows up as a keyboard and exposes a read-only disk called
   **`MYSTTIC`** with the configurator, the manuals and test forms inside.

Nothing has to be copied onto the device; everything is built into the firmware.

**The prototype variant (CircuitPython)** is for development only: directory
`circuitpython-prototype/`, run `install.ps1` (Windows, right-click, *Run with
PowerShell*), or drag `flash/*.uf2` onto `RPI-RP2` by hand and copy the contents
of `device/` onto the `CIRCUITPY` disk. Differences between the variants:
[Architecture](architecture.md).

## 4. Setting up a brand-new scanner module

A new module may be shipped with USB output enabled instead of UART. If the
scanner beeps on a read but nothing is typed, you need two configuration barcodes
from the manufacturer's manual:

1. **"Series Output"** switches the module from USB output to UART,
2. **"Induction Mode"** makes it read as soon as a code is presented, with no
   trigger.

The manual is copyrighted by the manufacturer and is not redistributed here. For
the Waveshare unit it is on the
[Barcode Scanner Module wiki](https://www.waveshare.com/wiki/Barcode_Scanner_Module)
(the "Setting Manual" PDF); for GM65 boards, search for "GM65 barcode scanner
module user manual". Both carry the same barcodes.

Both settings can also be applied over UART instead of scanning:
`firmware-circuitpython/setup_induction.py` sends the commands (`7E 00 …` plus a
CRC16-XModem, zone bit `0x0000`) and stores the mode in the module's EEPROM.

## 5. First scan

Open a text editor, click into it and scan any EAN code. The text plus ENTER
should appear; ten scans of the same code give ten identical lines.

Then open **`tests.html`** from the `MYSTTIC` disk: it is a menu of test forms
with codes you can scan straight off the screen. The full acceptance walkthrough
is in [Contributing](CONTRIBUTING.md#out-of-the-box-test).

Next step: [Configuration](configuration.md) — profiles are what turn a scan into
filled-in form fields.

## USB identity

The firmware presents itself as `1209:0001`. VID `0x1209` belongs to
[pid.codes](https://pid.codes/), a registry for open-source hardware, and PID
`0x0001` is reserved there **for testing** — the right choice for a device you
build for yourself. To place a product on the market, request your own PID
(https://pid.codes/howto/) and change `USB_PID` in
`firmware-pico-sdk/src/usb_descriptors.c`.

There is no enclosure design in the repository yet; it is on the
[roadmap](roadmap.md) together with a PCB.

## When it does not work

| Symptom | Cause and fix |
|---|---|
| the scanner beeps but nothing is typed | the module's output is set to USB (scan "Series Output"), or TXD/RXD are not crossed over |
| garbage characters or stray `\x00` | wrong baud rate, scan "9600bps (Default)" |
| everything is typed twice | you are holding the code in front of the lens; use duplicate blocking in the configurator (1.5 s by default) |
| the application drops characters, or TAB does nothing | increase "key delay" and "pause after TAB/ENTER"; fields with autocomplete can swallow TAB |
| configurator: timeout after connecting | on the CircuitPython prototype there are two ports and the first one is the console; disconnect and choose the other |
| the device loops on an error after a config change | not possible with correct firmware (validation plus fallback); a factory reset with the GP2 button at power-on always works |

## Updating the firmware

1. Download the new package and verify the SHA-256 sums (`SHA256SUMS.txt`).
2. In the configurator: the **Aktualizacja** (Update) tab → **Restart do
   bootloadera** (Reboot to bootloader), or use BOOT+RST by hand.
3. Drag the new `.uf2` onto `RPI-RP2`.

User configuration lives in the board's flash and **survives an update**. To
restore factory settings use the button in the configurator, or hold the button
on GP2 for about a second while plugging in USB.
