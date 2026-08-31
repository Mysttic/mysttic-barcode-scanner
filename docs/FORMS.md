# Filling forms — every variant

The scanner is a keyboard, so "filling a form" is always one of five strategies.
Demo forms for each variant, with QR codes you can scan off the screen, are in
[test-vectors](../test-vectors/README.md).

## Variant A — a sequence of tabs (works EVERYWHERE)

**When:** any page or application, desktop ones included, whose fields have a
stable TAB order.

**How:** a profile in the scanner cuts the code into fields and types them
interleaved with TABs, for example `{imie} TAB {nazwisko} TAB {numer} TAB
{dzial} ENTER`. The operator clicks the first field and scans; the scanner does
the rest.

**Demo:** `test-vectors/forms/form-a-tab.html` (code `PRC;JAN;KOWALSKI;12345;IT`,
profile `pracownik-tab`). Also verified on a real third-party page (httpbin.org)
with no changes on the page's side.

**Limits:** the field order has to be fixed, and fields with autocomplete can
swallow a TAB (Notepad++ does). Target applications rarely do this, and the pause
after TAB can be lengthened in the configuration.

## Variant B — fields by name (our own page, no extension)

**When:** a page whose HTML we control (an in-house system, an intranet).

**How:** the scanner works one to one, and the page carries a small
keyboard-wedge script: it recognises a frame by its prefix (`EMP;`, say), parses
it after ENTER and inserts the values into fields **by their names**, so field
order and focus do not matter. A reference script of about 30 lines is in
`test-vectors/forms/form-b-names.html`.

**Demo:** `test-vectors/forms/form-b-names.html` (code
`EMP;ANNA;NOWAK;67890;HR`), deliberately with a shuffled field order and decoy
fields.

## The GS1 variant — product codes (pharmacy, warehouse)

**When:** GS1 DataMatrix or QR codes with the fields GTIN (01), expiry date (17),
batch (10) and serial number (21).

**How:** a profile with **GS1** parsing. The scanner takes the code apart itself,
including the invisible GS separator, converts the date to `YYYY-MM-DD` (day
"00" meaning the last day of the month) and types the fields as a sequence, for
example `{gtin} TAB {dataWaznosciISO} TAB {partia} TAB {numerSeryjny} ENTER`.

**Demo:** `test-vectors/forms/form-gs1.html`.

## Variant C — fields by name on third-party pages (the extension)

**When:** a page whose code we do **not** control and where variant A is out:
fields in a different order than the data in the code, decoy fields between them,
a single-page app rebuilding the form on the fly.

**How:** the browser extension recognises the form (address plus the presence of
fields), captures the scan and spreads it across the fields by name. The captured
"scan" also covers a **TAB sequence from a device profile**: the scanner stays
permanently in its production configuration, and on a recognised page the
extension catches the whole series (the TABs do not move focus) and distributes
the values itself. Outside recognised forms the extension does nothing, the
scanner types like an ordinary keyboard, and variants A and B keep working
unchanged. **Nobody switches profiles during work.**

**Demo:** `test-vectors/forms/form-c-extension.html` (the same sequence as in
variant A, from the `pracownik-tab` profile), a single-page app with two views:
the profile matches the first one, and the extension stays silent on the second.
A second demo: `test-vectors/forms/form-c-medicine.html`, a medicine order with a
GS1 DataMatrix like the ones on real boxes (the sequence of the production
`gs1-datamatrix` profile) and a demonstration of profiles switching automatically
between pages.

**Installation, learning mode and the profile format:**
[BROWSER-EXTENSION.md](BROWSER-EXTENSION.md).

**Limits:** it only works in a browser (desktop applications: see variant A or
D); a closed Shadow DOM is out of reach for selectors; typeahead fields may need
the choice confirmed by hand.

**Fallback with nothing installed:** a simplified version of the same idea as a
bookmarklet, [`test-vectors/bookmarklet.html`](../test-vectors/bookmarklet.html)
(drag the link onto the bookmarks bar; click it after every page reload, with
selector profiles baked into the link). For diagnostics, not for production.

## Variant D — desktop applications (a tray agent)

**When:** a windowed application (not a browser) where a TAB sequence is too
fragile, or the fields have to be filled in an arbitrary order, including
applications running in kiosk mode.

**How:** the agent sits in the system tray, recognises the window (process plus
title), captures the scan and replays a **macro it was taught**: filling fields
by control identifier (UI Automation), clicks and keystrokes. Teaching is a
recording of what the operator does by hand. Outside the applications it was
taught, the agent does nothing.

**Module:** [`desktop-agent/`](../desktop-agent/README.md), independent of the
extension and the firmware and **optional**: the release package contains a
`desktop-agent/` directory with an installer, and a portable demo application is
published next to the package. Manual: [DESKTOP-AGENT.md](DESKTOP-AGENT.md).

**Demo:** `desktop-agent/test-app` (WinForms: a login screen and an employee card
with decoy fields), with a profile in `desktop-agent/test-app/profile/`.

**Limits:** applications running as administrator need an elevated agent;
Citrix/RDP and hand-drawn interfaces expose no controls (leaving coordinates or
TABs); the agent never fills password fields.

## A range: third-party pages for testing variant C

Verified live (2026-08-20), these public training pages are good for practising
the "profile for a page → scan → fields filled" procedure and the extension's
learning mode. They exist to be automated against, so you can practise on them
freely:

| Page | Scenario | Fields (selectors) | Notes |
|---|---|---|---|
| [selenium.dev/…/web-form.html](https://www.selenium.dev/selenium/web/web-form.html) | baseline, every field type | `name=my-text`, `my-password`, `my-textarea`, `my-select`, `my-check`, `my-radio`, `my-date` | the simplest and most stable; the official Selenium page |
| [parabank.parasoft.com/…/register.htm](https://parabank.parasoft.com/parabank/register.htm) | registration with a full address | `id=customer.firstName`, `customer.lastName`, `customer.address.street`, `customer.address.city`, `customer.address.state`, `customer.address.zipCode`, `customer.phoneNumber` | classic HTML with no framework; dots in the ids, so select with `[id="…"]` |
| [practicesoftwaretesting.com/auth/register](https://practicesoftwaretesting.com/auth/register) | shop, registration with an address | `id=first_name`, `last_name`, `dob` (YYYY-MM-DD), `country` (select), `postal_code`, `house_number`, `street`, `city`, `state`, `phone`, `email` | Angular; also has `data-test`; the date field is ISO, ideal for `{dataWaznosciISO}` from GS1 |
| [practicesoftwaretesting.com](https://practicesoftwaretesting.com/) | shop, search and filters | `id=search-query`, checkboxes `name=category_id` | tests "type into the search box and submit", plus filters |
| [demoqa.com/automation-practice-form](https://demoqa.com/automation-practice-form) | a large training form | `id=firstName`, `lastName`, `userEmail`, `userNumber`, `currentAddress` | React, and a trap: setting `value` alone does nothing, the extension has to fire native `input` events |
| [automationexercise.com/login](https://automationexercise.com/login) | shop, two-step signup | step 1: `name=name`, `name=email` (`data-qa=signup-name/-email`); the full address in step 2 | a trap: TWO `name=email` fields on the page (login and signup), so it tests targeting within a form context |
| [datatables.net/examples/basic_init/zero_configuration.html](https://datatables.net/examples/basic_init/zero_configuration.html) | live table filtering | `id=dt-search-0` | the filter reacts to every character, which verifies `input` events while typing |
| [httpbin.org/forms/post](https://httpbin.org/forms/post) | a simple order form | `name=custname`, `custtel`, `custemail` | already verified with variant A (TABs), good for comparing the two approaches |

Dropped: demo.nopcommerce.com (a waiting queue before entry) and saucedemo.com
(the address form only appears after logging in). Do NOT submit test forms on
real production shops; the pages above exist for this.

## Running the demo forms

Open `test-vectors/forms/form-*.html` directly (double-click) or through a local
server: `python -m http.server 8124` inside `test-vectors`, then go to
`http://localhost:8124/`. Enable the matching profiles in the configurator first
([CONFIGURATION.md](CONFIGURATION.md)).
