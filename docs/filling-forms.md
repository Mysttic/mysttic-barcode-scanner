# Filling forms

The scanner is a keyboard, so getting data into a form is always one of four
strategies. Demo forms for each, with codes you can scan off the screen, are on
the device's own disk (`tests.html`) and in `test-vectors/`.

| Variant | Works where | What does the work |
|---|---|---|
| **A — TAB sequence** | anywhere, browsers and desktop applications alike | a profile in the scanner |
| **B — by field name, our page** | pages whose HTML we control | a small script on the page |
| **C — by field name, any page** | third-party pages, single-page apps | the [browser extension](browser-extension.md) |
| **D — by field name, Windows apps** | native applications, including kiosk mode | the [desktop agent](desktop-agent.md) |

Variants A and B need nothing installed on the computer. C and D are optional
modules, and installing them changes nothing outside the forms they recognise.

## A — a sequence of tabs

A profile in the scanner cuts the code into fields and types them interleaved
with TABs, for example `{firstName} TAB {lastName} TAB {number} TAB {department} ENTER`. The
operator clicks the first field and scans; the scanner does the rest.

Demo: `forms/form-a-tab.html` (code `PRC;JAN;KOWALSKI;12345;IT`, profile
`employee-tab`). Also verified on a real third-party page (httpbin.org) with no
changes on the page's side.

Limits: the field order has to be fixed, and fields with autocomplete can swallow
a TAB (Notepad++ does; target applications rarely do). The pause after TAB can be
lengthened in the [configuration](configuration.md).

**GS1 codes** work the same way, with a profile that parses GS1 instead of a
regular expression: the scanner takes the code apart itself, including the
invisible GS separator, converts the date to `YYYY-MM-DD` (day "00" meaning the
last day of the month) and types `{gtin} TAB {expiryISO} TAB {batch} TAB
{serial} ENTER`. Demo: `forms/form-gs1.html`.

## B — fields by name, on a page we control

The scanner types the code verbatim and the page carries a small keyboard-wedge
script: it recognises a frame by its prefix (`EMP;`, say), parses it after ENTER
and inserts the values into fields **by their names**, so field order and focus do
not matter. A reference script of about 30 lines is inside
`forms/form-b-names.html` (code `EMP;ANNA;NOWAK;67890;HR`, deliberately with a
shuffled field order and decoy fields).

## C — fields by name, on any page

For pages whose code we do not control and where a TAB sequence is too fragile:
fields in a different order than the data in the code, decoy fields between them,
a single-page app rebuilding the form on the fly.

The extension recognises the form (address plus the presence of fields), captures
the scan and spreads it across the fields by name. The captured "scan" also covers
a **TAB sequence from a device profile**, so the scanner stays permanently in its
production configuration and nobody switches profiles during work. Outside
recognised forms the extension does nothing.

Full instructions, the profile format and the tutorial for teaching a new form:
[Browser extension](browser-extension.md).

Limits: browsers only; a closed Shadow DOM is out of reach for selectors;
typeahead fields may need the choice confirmed by hand.

There is also a **bookmarklet** (`test-vectors/bookmarklet.html`) with a
simplified version of the same idea, for diagnostics when nothing can be
installed.

## D — fields by name, in Windows applications

The agent sits in the system tray, recognises the window (process plus title),
captures the scan and replays a **macro it was taught**: filling fields by control
identifier (UI Automation), clicks and keystrokes. Teaching is a recording of what
the operator does by hand. Outside the applications it was taught, it does
nothing. Details: [Desktop agent](desktop-agent.md).

Limits: applications running as administrator need an elevated agent; Citrix/RDP
and hand-drawn interfaces expose no controls, which leaves coordinates or TABs;
password fields are never filled.

## Which codes are supported

Symbologies are decoded inside the scanner module (see
[Getting started](getting-started.md)). What the profile layer does with the
decoded text:

| Format | Support | Notes |
|---|---|---|
| any ASCII text | yes, verbatim or a group regex | printable characters; frames up to about 6 KB |
| frames with separators (`PRC;…`, `EMP;…`) | yes, verified | a group regex in the scanner, or splitting in the extension |
| GS1: AI **01** (GTIN-14), **17** (date, day 00 becomes end of month), **10** (batch), **21** (serial) | yes, verified on the pharmacy format | any AI order, GS handled, AIM `]d2` stripped |
| GS1: other AIs (`30`, `11`, `15`, `240`, `710-714`…) | no, deliberately | such an AI is a parse error, so the behaviour follows `onError`: verbatim or skip. Extending the table is on the [roadmap](roadmap.md) |
| Russian cryptographic codes (AI 91-93) | no | a different ecosystem; same safe fallback |
| German PPN (IFA, the `[)>…06…` envelope) | no | not GS1, so detection does not match and the code passes through |

## Where the limits are

| Limit | Why | What happens |
|---|---|---|
| non-ASCII characters in the HID output | a US keyboard layout, and barcodes are ASCII | non-printable and non-ASCII characters are filtered out |
| the GS separator over the keyboard | HID carries only printable characters | field boundaries come from the scanner profile's sequence |
| a code with an unknown AI, or one a profile fails to parse | the parser does not guess field boundaries | verbatim **or** skip, per configuration; the extension rejects the frame and hands it back to the page, and **never writes into the wrong fields** |
| applications with no accessibility support (Citrix/RDP) | no control tree to address | the agent falls back to window-relative coordinates, or TABs remain |
| closed Shadow DOM, and `password` fields | selectors cannot reach it / deliberate | skipped; passwords are never filled |
| the configurator outside Chrome and Edge | Web Serial is Chromium-only | configure from another workstation; the scanner is unaffected |
| workstations that block USB storage | the disk may be blocked by policy | keyboard and configuration over USB serial still work; take the configurator from the release package |

Parametric limits of the production firmware: 6 profiles, 8 fields and 16 actions
per profile, a 4 KB configuration, a 6 KB protocol line, a 256 KB device disk, and
regular expressions limited to `^ $ . [] * + ? ()` plus `\d \w \s` (no `{m,n}`,
no alternation).

## Practising on third-party pages

These public training pages exist to be automated against, so they are a safe
place to rehearse "make a profile → scan → fields filled" and the extension's
learning mode (verified 2026-08-20):

| Page | Scenario | Notes |
|---|---|---|
| [selenium.dev/…/web-form.html](https://www.selenium.dev/selenium/web/web-form.html) | every field type | the simplest and most stable |
| [parabank.parasoft.com/…/register.htm](https://parabank.parasoft.com/parabank/register.htm) | registration with a full address | classic HTML; dots in the ids, so select with `[id="…"]` |
| [practicesoftwaretesting.com/auth/register](https://practicesoftwaretesting.com/auth/register) | shop registration | Angular; the date field is ISO, ideal for a GS1 expiry date |
| [demoqa.com/automation-practice-form](https://demoqa.com/automation-practice-form) | a large training form | React: setting `value` alone does nothing, native events are required |
| [automationexercise.com/login](https://automationexercise.com/login) | two-step signup | two `name=email` fields on one page, so it tests targeting within a form |
| [datatables.net/examples/basic_init/zero_configuration.html](https://datatables.net/examples/basic_init/zero_configuration.html) | live table filtering | reacts to every character, which verifies input events |
| [httpbin.org/forms/post](https://httpbin.org/forms/post) | a simple order form | already verified with variant A |

Do not submit test data on real production shops; these pages are there for it.
