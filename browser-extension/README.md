# Browser extension

Fills forms with data from a scan **by field name**, for pages where a TAB
sequence is too fragile. Outside recognised forms the extension does nothing and
the scanner behaves like an ordinary keyboard.

User manual (installation, learning mode, profile format):
[docs/BROWSER-EXTENSION.md](../docs/BROWSER-EXTENSION.md).

The code and the user interface are in Polish; see the note in
[CONTRIBUTING.md](../CONTRIBUTING.md).

## File layout

| File | Role |
|---|---|
| `manifest.json` | MV3; a content script on every page, with only the `storage` permission |
| `src/parse.js` | frame to named fields (`delimited`, `regex`, `gs1`) |
| `src/fill.js` | writing values in a way React, Vue and Angular accept, plus reading them back |
| `src/store.js` | form profiles, address matching, settings |
| `src/content.js` | recognising the form (including in single-page apps), capturing the scan, learning mode |
| `src/background.js` | the state badge and broadcasting configuration changes |
| `src/popup.*` | the current tab's state, the on/off switch, entry into learning mode |
| `src/options.*` | the profile list plus JSON editing, import and export |
| `icons/` | generated from `brand/icon.svg` by `node brand/make_icons.mjs` |

No bundler: the files reach the browser exactly as they are in the repository.
`package.json` exists only for the tests.

## Tests

```bash
npm ci
npm test          # unit: parsing, address matching, transformations
npm run test:e2e  # Chromium with the extension loaded plus test-vectors/forms/form-c-extension.html
```

The documentation screenshots (`docs/img/extension-*.png`) are regenerated with
`npm run shots`: the same scenario walked through live in Chromium, so the images
do not drift away from the code.

The e2e test needs a Playwright browser (`npx playwright install chromium`) and a
graphical environment (`xvfb-run -a npm run test:e2e` on a server).
