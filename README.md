<p align="center">
  <img src="brand/logo.svg" alt="Mysttic Barcode Scanner" width="420">
</p>

<p align="center">
  A programmable USB barcode scanner that types scans into forms, field by field.
  <br>
  RP2040 plus a 1D/2D scanner module, no drivers, nothing to install on the host.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-blue.svg"></a>
  <a href="https://github.com/Mysttic/mysttic-barcode-scanner/releases"><img alt="Latest release" src="https://img.shields.io/github/v/release/Mysttic/mysttic-barcode-scanner"></a>
  <a href="https://github.com/Mysttic/mysttic-barcode-scanner/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/Mysttic/mysttic-barcode-scanner/actions/workflows/ci.yml/badge.svg"></a>
</p>

---

Plug the scanner in, hold a barcode or QR code in front of it, and the decoded
value is typed into the active window as if someone had entered it on a
keyboard. No drivers, nothing to install on the computer, works on any operating
system that accepts a USB keyboard.

What makes it different from an off-the-shelf scanner are **profiles**: the
device recognises the kind of code it just read, splits it into fields and types
them in a defined order with TAB and ENTER in between, straight into the
matching boxes of a form. Everything is configured from a web page served by the
scanner itself, off a small read-only disk it exposes over USB.

## What it does

- works the moment it is plugged in, exactly like a USB keyboard,
- scans on presentation, without pressing a button,
- splits codes into fields and fills forms, including GS1 codes (product number,
  expiry date, batch, serial number),
- guards against duplicate scans and paces typing for slow applications,
- configuration without installing anything: open `configurator.html` from the
  scanner's own disk,
- a **browser extension** fills forms *by field name* where a fixed TAB sequence
  is too fragile (third-party pages, single-page apps),
- an optional **desktop agent** does the same in native Windows applications,
  including kiosk-mode software,
- firmware updates by dragging one file; release packages are built by CI.

## Where to start

| I want to... | Read |
|---|---|
| build or install the scanner | [docs/INSTALL.md](docs/INSTALL.md) |
| configure scanning and profiles | [docs/CONFIGURATION.md](docs/CONFIGURATION.md) |
| fill in forms (all the available approaches) | [docs/FORMS.md](docs/FORMS.md) |
| fill in forms by field name on third-party pages | [docs/BROWSER-EXTENSION.md](docs/BROWSER-EXTENSION.md) |
| teach the extension a new form (step-by-step tutorial) | [docs/LEARNING-PROFILES.md](docs/LEARNING-PROFILES.md) |
| fill in forms in desktop applications (optional module) | [docs/DESKTOP-AGENT.md](docs/DESKTOP-AGENT.md) |
| test the device (out-of-the-box scenario, unit and e2e tests) | [docs/TESTING.md](docs/TESTING.md) |
| know what the system can and cannot do, and which codes it handles | [docs/CAPABILITIES.md](docs/CAPABILITIES.md) |
| see what is planned next | [docs/ROADMAP.md](docs/ROADMAP.md) |
| understand the technical details | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| follow the design decisions | [docs/DECISIONS.md](docs/DECISIONS.md) |
| pick the hardware | [docs/HARDWARE.md](docs/HARDWARE.md) |
| see what changed | [CHANGELOG.md](CHANGELOG.md) |

The scanner's own disk (`MYSTTIC`) carries everything needed for daily work
without this repository: the configurator, the manuals (`MANUAL.md`,
`BROWSER-EXTENSION.md`, `LEARNING-PROFILES.md`) and test forms (`tests.html`)
with codes you can scan straight off the screen.

## Wiring (minimum)

Four wires, and the UART crosses over: the module transmits into GP1 and
receives from GP0.

![Wiring: the RP2040 board and the scanner module](docs/img/wiring-minimal.png)

In connector order on our module (a Waveshare 14810):

| Scanner module pin | RP2040 board pin | Wire in the diagram |
|---|---|---|
| VCC | 5 V (VBUS, pin 40) | black |
| TXD | **GP1** (pin 2) | orange |
| RXD | **GP0** (pin 1) | violet |
| GND | GND (pin 38, or any other GND) | grey |

Pin order differs between scanner modules, and wire colours mean nothing in
either the diagram or the harness that comes in the box. Go by the labels on your
board. Assembly details, the parts to buy and troubleshooting:
[docs/HARDWARE.md](docs/HARDWARE.md) and [docs/INSTALL.md](docs/INSTALL.md).

## Releases

Ready-to-use packages live under the **Releases** tab. Development happens on the
`develop` branch; the release and testing process is described in
[docs/TESTING.md](docs/TESTING.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Contributing

Bug reports, hardware notes and pull requests are welcome. Start with
[CONTRIBUTING.md](CONTRIBUTING.md); security issues have their own path in
[SECURITY.md](SECURITY.md).

## License

Apache License 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE). Components from
other projects that ship in the release package are listed in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

The user interface of the configurator, the browser extension and the desktop
agent is currently in Polish; translating it is tracked in
[docs/ROADMAP.md](docs/ROADMAP.md).
