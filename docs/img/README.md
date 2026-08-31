# Images in the documentation

Nothing in this directory is edited by hand. Every image is generated from the
real thing, so it cannot drift away from the product. This file says which
command produces what, and where each source lives.

| Images | Source | How to regenerate |
|---|---|---|
| `extension-*.png` | Chromium with the extension loaded, walking the real learning wizard on the demo forms | `cd browser-extension && npm run shots` |
| `configurator-*.png` | the built configurator, driven against a **stub device** (no hardware needed) | `node configurator/tests/screenshots.mjs` |
| `agent-*.png` | the desktop agent and the demo application, both running | `MystticBarcodeAgent.exe --zrzuty docs/img --proces MystticDemoApp` |
| `wiring-minimal.png` | the saved Wokwi project, rendered headless | `node hardware/wokwi/render-diagram.mjs` |

The configurator normally talks to the scanner over Web Serial, so its
screenshots used to require a device on the desk. The generator now substitutes
`navigator.serial` with a stub that speaks the same NDJSON protocol as the
firmware and serves the production `default_config.json`, which is why anyone can
refresh these images with one command.

Build the configurator first (`cd configurator && npm run build`) if you changed
its sources; the screenshots are taken from `configurator/dist/index.html`, the
same file that ends up on the device disk.

## Brand assets

The logo and the icons are not here. Their sources live in
[`brand/`](../../brand):

| File | What it is |
|---|---|
| `brand/icon.svg` | the mark alone (the source for every icon) |
| `brand/logo.svg` | the mark plus the product name, for a light background |
| `brand/logo-dark.svg` | the same for a dark background; the README picks between them with `prefers-color-scheme`, because GitHub renders SVG as an image and `currentColor` would come out black on both themes |
| `brand/make_icons.mjs` | rasterises the mark into the extension icons and the configurator's favicon |
| `brand/make_ico.py` | builds the `.ico` used by the agent and the demo application |

After editing `brand/icon.svg`:

```bash
node brand/make_icons.mjs && python brand/make_ico.py
```

then rebuild the configurator and the .NET applications so they pick the new icon
up.

## Changing the wiring diagram

`wiring-minimal.png` is a render of the Wokwi project. The source of truth for
the circuit is [`hardware/wokwi/diagram-minimal.json`](../../hardware/wokwi/diagram-minimal.json),
and the saved project is
<https://wokwi.com/projects/472807254038722561>.

To rework it:

1. Open the project above (or create a new one at
   <https://wokwi.com/projects/new/micropython-pi-pico> and paste
   `diagram-minimal.json`, `gm65.chip.json` and `gm65.chip.c` into their tabs).
2. Rearrange the parts and wires. Keep the wire colours matching
   [getting started](../getting-started.md), because the table there refers to them.
3. Save the project in Wokwi, and copy the edited diagram back into
   `hardware/wokwi/diagram-minimal.json`.
4. Re-render the picture:

```bash
node hardware/wokwi/render-diagram.mjs
```

The renderer opens the **saved** project headless, crops the canvas to the parts
and writes `docs/img/wiring-minimal.png` at 2x scale. It reads from Wokwi, not
from the local file, so save the project first; otherwise the picture will show
the previous version.

Note that the pin order of the scanner stand-in lives in
[`hardware/wokwi/gm65.chip.json`](../../hardware/wokwi/gm65.chip.json) and mirrors
the real module (VCC, TXD, RXD, GND). If you swap to a module with a different
connector, change that file rather than rewiring the diagram, so the pin names in
the connections keep meaning what they say.

The fuller simulation (with the dummy scanner chip `gm65.chip.c`) is
`hardware/wokwi/diagram.json`; the minimal one exists only to be readable as a
wiring picture in the documentation.
