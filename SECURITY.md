# Security policy

## Supported versions

Only the latest released version is supported. Fixes go into `develop` and reach
users with the next release.

## Reporting a vulnerability

Please report security issues privately, not as a public issue:

- open a [private security advisory](https://github.com/Mysttic/mysttic-barcode-scanner/security/advisories/new)
  on GitHub (preferred), or
- write to the address in the repository owner's GitHub profile.

Include what you did, what happened, and what an attacker gains. Expect an
acknowledgement within a few days. This is a hobby-scale project, so please do
not expect a same-day turnaround.

## What is in scope

The parts that process untrusted input or run with the user's privileges:

- **firmware** (`firmware-pico-sdk/`): the scan framer and parsers handle data
  coming straight off a scanned code, and the CDC channel accepts configuration
  from the host,
- **browser extension**: it observes keystrokes on every page and writes into
  form fields,
- **desktop agent**: it installs global keyboard and mouse hooks and replays
  macros with synthetic input,
- **configurator**: it is a local HTML page that talks to the device over Web
  Serial.

## Things that are known and intended

These are design decisions, not vulnerabilities:

- The scanner presents itself as a **USB keyboard**, so anything it types goes
  into the focused window. A barcode can therefore contain any text a keyboard
  can produce. Treat printed codes from unknown sources with the same care as a
  USB stick found in a car park.
- The configurator disk is **read-only** and the configuration channel is a
  plain USB CDC serial port with no authentication: whoever can physically plug
  into the device can reconfigure it.
- The desktop agent replays **whatever the operator recorded**, including mouse
  clicks and keystrokes. Its profile files are plain JSON in the user's profile
  directory; anyone able to write there can change what the agent does.
- Neither the extension nor the agent sends anything anywhere. There is no
  network code in either of them, and no telemetry in the project.
