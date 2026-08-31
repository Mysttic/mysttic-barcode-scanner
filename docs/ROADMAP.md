# Roadmap

Starting point (2026-08-21): the product works end to end on hardware — the C
firmware with the `MYSTTIC` disk, the configurator, the extension with profile
learning, and a full test suite. The work below is ordered by priority; the
reasoning behind individual decisions is in [DECISIONS.md](DECISIONS.md).

## 1. Closing out release 1.0 (immediate)

- [ ] **Go through the full out-of-the-box scenario** as the owner
  ([TESTING.md](TESTING.md), section 0) plus `tools/test_e2e.py`. That is the
  formal acceptance criterion.
- [ ] **The C firmware version taken from VERSION.md** at build time (today
  `ping` and the configurator report `0.0.0-dev`).
- [x] ~~**Release package**: the variant C UF2 plus the extension and the
  manuals~~ — done on 2026-08-21: the package carries the production firmware,
  the extension with its version from VERSION.md, the full documentation and,
  separately, the CircuitPython prototype; CI compiles the C firmware before
  building the package.
- [x] ~~**Release 1.0**~~ — published on 2026-08-24 (tag `v1.0.0`, PR #7). The
  package was downloaded and verified: the SHA-256 sum matched, 40 of 40 files
  agreed with `SHA256SUMS.txt`, version 1.0.0 appeared in the firmware and in the
  extension manifest, and the disk inside the UF2 contained all 11 files matching
  the repository.
- [ ] **Test-mode events in C** carrying the profile name and the fields (parity
  with CircuitPython, the last known difference).

## 2. Robustness across code formats

- [ ] **Extend the GS1 parser's AI table** with the extras commonly found on
  packaging: `11` (production date), `15` (best before), `30` (quantity), `240`,
  `710-714` (national numbers), in all three implementations at once
  (CircuitPython, C, extension) plus shared test vectors. The effect: an unused
  AI stops breaking the parse.
- [ ] Collect **real codes from the target wholesalers and pharmacies** and run
  them through the configurator's Test tab (a compatibility matrix before
  deployment).
- Out of scope, pending a separate decision: PPN (Germany) and the cryptographic
  codes 91-93 (Russia). Different ecosystems, and today they have a safe fallback
  ([CAPABILITIES.md](CAPABILITIES.md)).

## 3. Productising the hardware

- [ ] a PCB instead of a breadboard (module, RP2040, JST connector),
- [ ] a 3D-printed enclosure with a scanner window and a service button,
- [ ] **a USB PID of our own** before selling anything (today the pid.codes test
  identifier `1209:0001` is used),
- [ ] a sticker on the underside with a QR code pointing at the documentation and
  releases.

## 4. Ergonomics and rollouts (as needed)

- [ ] a simple mode for the configurator (feedback from E7: "too technical for an
  end user"),
- [ ] deploying the extension by policy (`ExtensionInstallForcelist` plus
  profiles through `storage.managed`); today it is "Load unpacked",
- [ ] Polish and German keyboard layouts in HID (today US/ASCII, which is enough
  for codes),
- [ ] automatic port selection in the configurator (a ping timeout instead of
  picking by hand).

## 4b. The desktop agent (a new module, prototype ready)

Status: the module works and is released together with the rest of the product
(34 unit assertions, 27 e2e ones against a live application, an installer, a
portable demo application and screenshots in the manual). Details:
[DESKTOP-AGENT.md](DESKTOP-AGENT.md).

- [ ] **A test with a physical scanner** (so far only a simulated key stream) and
  **a manual run through learning mode** by an operator.
- [ ] A test in a real kiosk application (the Ctrl+Alt+F9 shortcut, the wizard
  window over a full screen).
- [x] ~~A profile editor in the interface~~ — done: the "Profile (zarządzaj)"
  window (enable and disable, name, process, title pattern, step preview,
  deletion).
- [ ] One-click profile import and export to a file (as in the extension).
- [ ] Elevation when the target application runs as administrator (a manifest
  with `requireAdministrator`, or a restart on demand).
- [x] ~~Installer and autostart, plus wiring the module into the release
  package~~ — done on 2026-08-28: `desktop-agent/` in the package (a standalone
  executable, `install-agent.ps1` and an example profile), the portable demo
  application as a separate release asset, an `agent-desktopowy` job in CI and
  the agent built as part of the release.
- [ ] Consider a single source for the parsers (today the GS1 logic exists in
  three implementations: C, JavaScript, C#, kept in step by shared test vectors).

## 4c. Open source and internationalisation

- [x] ~~Licence, notices and community files~~ — done: Apache-2.0, `NOTICE`,
  `THIRD-PARTY-NOTICES.md`, `CONTRIBUTING.md`, `SECURITY.md`, a code of conduct
  and issue templates.
- [x] ~~Product identity~~ — done: the name Mysttic Barcode Scanner across the
  USB descriptors, the device disk, the extension, the agent and the packages,
  with a logo and icons generated from `brand/icon.svg`.
- [ ] **Translate the user interfaces** (configurator, extension, desktop agent,
  demo forms) to English. The documentation is already in English; the interfaces
  are still Polish, which is the biggest remaining barrier for contributors from
  outside Poland. It should be one coordinated change, including the test
  assertions that check on-screen text.
- [ ] A live demo on GitHub Pages (the configurator and the test forms are static
  files, so they can be published as they are).
- [ ] Publish the extension in the Chrome Web Store (deliberately skipped so far,
  the deployment was internal).

## 5. The extension — phase 2 (when the wedge stops being enough)

- [ ] a CDC transport instead of listening to the keyboard (structured data
  straight from the device, `host` mode plus a heartbeat; it needs firmware
  changes and has been deliberately postponed). This also concerns the desktop
  agent: it would remove the need for a keyboard hook, which corporate policies
  sometimes block, and would carry the GS separator without workarounds,
- [ ] aggregating several scans into one form, and repeatable rows.

## Frozen or rejected (so we do not revisit them without a reason)

- **The bookmarklet as a production route** — rejected on user experience
  grounds; it stays as a diagnostic tool (`test-vectors/bookmarklet.html`).
- **The extension over Web Serial in phase 1** — rejected in favour of the wedge
  (no firmware changes, no fight over the port).
- **LittleFS in C** — rejected in favour of atomic A/B slots.
- **A writable MSC disk** — the disk is deliberately read-only (the configuration
  lives in flash and is reached over CDC, so there is nothing to break).
