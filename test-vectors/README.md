# Test vectors

Entry point: **`tests.html`**, a menu of all the forms with a description of what
to expect. The same set (`tests.html` plus `forms/`) is built into the scanner's
`MYSTTIC` disk, so it can be tested straight from the device. The full
out-of-the-box scenario: [docs/TESTING.md](../docs/TESTING.md), section 0.

All the tests run against ONE production configuration of the scanner (the
`pracownik-tab` and `gs1-datamatrix` profiles enabled).

The forms themselves are in Polish, matching the user interfaces.

## Demo forms

| File | Code | Mechanism |
|---|---|---|
| `forms/form-a-tab.html` | `PRC;JAN;KOWALSKI;12345;IT` (`qr_prc.png`) | the **pracownik-tab** profile in the scanner cuts the code into fields and sends `first name TAB surname TAB number TAB department ENTER`; the page is "dumb" and only the field order matters |
| `forms/form-b-names.html` | `EMP;ANNA;NOWAK;67890;HR` (`qr_emp.png`) | the scanner works verbatim (the code matches no profile) and **the page** listens to the keyboard (a keyboard wedge), recognises the frame by its `EMP;` prefix and distributes the values into fields by `name` |
| `forms/form-gs1.html` | a GS1 QR (embedded) | the **gs1-datamatrix** profile takes the code apart and fills the form with TABs: GTIN, ISO date, batch, serial number |
| `forms/form-c-extension.html` | the same code as in A | the **extension** captures the scanner's TAB sequence and spreads the fields by name; the fields are shuffled with decoys between them, and the page is a single-page app whose second view deliberately has no profile |
| `forms/form-c-medicine.html` | a GS1 DataMatrix like the one on a real medicine (`dm_lek.png`): `(01)05909991055172 (17)271000 (10)A23G05 (21)K7L9XW24MQ1R` | the scanner parses GS1 (day "00" becomes the end of the month) and **a second extension profile** captures the sequence and hits the order form's fields, demonstrating profile switching |

The files are self-contained (the codes are embedded in the HTML), so you scan
them straight off the screen.

Variant B is the "cooperating application" pattern without an extension, for
pages we control. Variant C does the same on third-party pages; installation,
learning mode and profile management are described in
[docs/BROWSER-EXTENSION.md](../docs/BROWSER-EXTENSION.md). The diagnostic
bookmarklet (variant C with nothing installed) is `bookmarklet.html`.

## How to run them

- **From the scanner:** plug it in and open `tests.html` from the `MYSTTIC` disk
  (for the extension, enable "Allow access to file URLs").
- **From the repository:** open `tests.html` by double-clicking it, or run
  `python -m http.server 8124` in this directory and go to
  `http://localhost:8124/tests.html`.
