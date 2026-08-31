# Browser extension

Fills forms with data from a scan **by field name**, for pages where a TAB
sequence is too fragile. Outside recognised forms it does nothing and the scanner
behaves like an ordinary keyboard.

- **User manual, profile format and the learning tutorial:**
  [docs/browser-extension.md](../docs/browser-extension.md)
- **Building and testing:** [docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md)

No bundler: the files reach the browser exactly as they are here. `package.json`
exists only for the tests, and `icons/` is generated from `brand/icon.svg`.

| File | Role |
|---|---|
| `src/parse.js` | frame to named fields (`delimited`, `regex`, `gs1`) |
| `src/fill.js` | writing values in a way React, Vue and Angular accept, plus reading them back |
| `src/store.js` | form profiles, address matching, settings |
| `src/content.js` | recognising the form, capturing the scan, learning mode |
| `src/background.js` | the state badge and broadcasting configuration changes |
| `src/popup.*`, `src/options.*` | the popup and the profile manager |
