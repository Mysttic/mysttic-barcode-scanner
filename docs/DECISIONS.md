# Design decisions

A running log of decisions, in reverse chronological order. It records not only
what was chosen but why, and what was rejected, so the same ground is not
re-covered later.

## 2026-08-31 — going open source: name, licence, English documentation

- **Owner's decision:** publish the project as open source under the name
  **mysttic-barcode-scanner**, licence **Apache-2.0**, documentation in English.
- **Why Apache-2.0 rather than MIT:** it carries an explicit patent grant and the
  NOTICE mechanism, which matters for a hardware product that may later be sold.
  The cost is a longer licence text, which is irrelevant here.
- **Product identity introduced in every place a user actually meets it:** the
  USB descriptors (manufacturer `Mysttic`, product `Mysttic Barcode Scanner`),
  the disk label (`MYSTTIC`, an 11-character FAT limit), the extension name and
  its icons (there were none, so Chrome showed a grey placeholder), the tray icon
  and executable icons for the agent and the demo application, a favicon and a
  header mark in the configurator, and the npm package names. The identity that
  is hardest to notice as missing is the one visible without opening anything:
  the device name in the system's device list.
- **USB VID/PID changed from `0xCAFE:0x4010` to `1209:0001`.** `0xCAFE` is the
  TinyUSB development placeholder and belongs to nobody; `0x1209` is the
  [pid.codes](https://pid.codes/) vendor ID for open-source hardware, and
  `0x0001` is its test PID. That is correct for a device built for oneself, and a
  product on the market still needs its own PID (recorded in the roadmap).
- **A real bug fell out of the rename.** The disk directory `formularze/` became
  `forms/`, which fits in 8.3 — and the FAT12 image generator only emitted a long
  file name entry when a name did *not* fit. Without one, the name comes back
  from the disk in upper case, so `forms/` became `FORMS/` and the generator's
  own read-back self-test caught it during the build. The condition now compares
  the name with its 8.3 form exactly, rather than case-insensitively. Worth
  remembering: the self-test paid for itself the first time a name changed.
- **Boundary drawn for the translation:** documentation, release artefacts and
  everything the customer sees in the package are in English; the source code,
  its comments and the user interfaces stay Polish. Translating the interfaces is
  a separate, coordinated change (test assertions check on-screen text), tracked
  in the roadmap as 4c. Mixing the two inside one module would be worse than
  either choice.
- **Removed from the repository's scope:** the GM65 manufacturer's manual (a
  copyrighted PDF) is no longer described as part of this project; `HARDWARE.md`
  says where to obtain it instead.

## 2026-08-28 — the desktop agent joins the release (an optional module)

- **Owner's decision:** the agent is to be released just like the extension, but
  stays **optional**; the customer decides whether to use it. Without it the
  scanner works as before (variant A).
- **Distribution:** a `desktop-agent/` directory in the release package (a
  standalone executable, the installer, an example profile, the manual and a
  short readme), and **next to the package** a separate
  `demo-app-v<version>-win-x64.zip` with a portable application to practise on.
  Both executables are built **self-contained single-file**, so the customer does
  not have to install .NET. The price: the package grew from 0.8 MB to 68 MB and
  the demo application is 44 MB, a deliberate trade for "it just runs".
- **An installer that needs no administrator rights:** it copies the agent into
  `%LOCALAPPDATA%`, adds a Start menu shortcut and autostart, with switches to
  skip autostart and to uninstall (profiles are kept). The example profile is
  copied into the configuration only when there is none yet.
- **CI/CD:** the agent is a Windows application while the package is assembled on
  Linux. Initially a Windows job built both executables and passed them on as an
  artifact, with `build_release.py` accepting them through `--agent-exe` and
  `--app-testowa-exe`. The agent's e2e tests need a desktop with real windows, so
  they stay local, which is noted in the testing document.
- **Manual screenshots are generated automatically** (`--zrzuty`): the scenario
  walks through the wizard live and saves the images, the same principle as
  `npm run shots` for the extension, so the pictures do not drift from the code.
- **Verified before being written up:** the full test suite plus **a complete run
  against the files from a finished package**: the unpacked portable demo
  application and the agent from the package captured a scan in the style of a
  real reader and filled the form, confirmed by the application's own state panel
  rather than by the fields alone.

## 2026-08-28 — the agent: a step mode instead of guessing the control type

- **Reported from a live test (Spotify):** a search box with suggestions appears
  in UI Automation as a plain `ComboBox` with no list items and no inner edit
  control, so the agent tried to "select the item JAN from the list" instead of
  typing. Successive heuristics (no items means a text field; an `Edit` control
  inside) were all wrong, because after the first search the control *does* get
  items (the suggestions), so the heuristic would fail again.
- **The fix: `Krok.Tryb` (`wpisz` / `wybierz` / `auto`).** The recorder stores the
  operator's intent: you typed text, so `wpisz`; you clicked a list item, so
  `wybierz`. The agent does not guess, it repeats the way it was taught. `auto`
  remains for hand-written profiles. In `wpisz` mode the character-exact
  read-back verification is skipped, because suggestion fields append their own
  text.
- **The learning wizard:** the save step now shows and allows editing of the
  **profile name, the process and the title pattern**. Previously only the name
  was editable and the pattern was taken verbatim from the window title at that
  moment, which for a media player meant a profile that only worked for one
  track. The wizard window now positions itself in the **bottom right corner of
  the screen the taught application is on**; before that it was the top right of
  the main screen, computed before DPI scaling, so it landed in the middle.
- Tests: 34 unit (including the mode assertions) plus 27 e2e. The demo
  application gained a "Stanowisko" field that is an editable list with items,
  and the scenario checks that it is filled in `wpisz` mode with a value that
  ALSO exists on the list.

## 2026-08-28 — the desktop agent: three bugs from the first live test

The owner went through profile learning by hand and the scan did nothing.
Diagnosis from the log and the saved profile found three independent faults, all
fixed and covered by tests:

- **Shift broke the frame (a repeat of the extension's bug).** The reader sends a
  separate Shift event before every capital letter; the decoder saw no character
  in it and treated it as the end of the scan, so the buffer was cleared on every
  letter and the agent never saw a single frame. On top of that,
  `GetKeyboardState` in the hook thread does not know the Shift state, so the
  letters would have decoded as lower case anyway. The fix: modifiers do not
  break a frame, and the Shift state is tracked manually (separately in the
  listener and in the recorder). **Lesson: we made the same mistake twice in
  different layers. With any new wedge, check the modifiers first.**
- **Learning lost case matching and the list selection.** The operator typed
  "jan" while the code contained "JAN"; the comparison was case-sensitive, so a
  literal "jan" was saved instead of `{imie}`. Picking the department with the
  mouse was recorded as two clicks (the list and the item "IT"), so the profile
  would forever select IT regardless of the code. The fix: matching ignores case
  and surrounding spaces, and a click on a list item whose name equals a value
  from the scan is merged into a `pole` step with a `{field}` reference (a
  selection that is not in the code still stays a plain click, which may be a
  deliberate constant).
- **The profile did not work until the agent was restarted.** The wizard always
  saved to the default path (ignoring `--profile`), and refreshing the
  configuration depended on a window-close event. The fix: save to the same file
  the agent reads from, reload explicitly right after saving (with a toast) and
  add a **file watcher** on the profile file, so an external change (manual
  editing, provisioning) also takes effect immediately.
- **A methodological gap:** the recorder's unit test **duplicated** the
  production logic instead of calling it, which is why it let two of these bugs
  through. The logic was extracted into a static method and the test now calls
  the real code. A `--wyslij --hid` mode was added, which simulates the reader
  with key codes and Shift, so the modifier bug is caught automatically from now
  on.

## 2026-08-24 — the desktop agent: variant C outside the browser (a new module)

- **Owner's requirement:** carry the extension's functionality into desktop
  applications, including kiosk ones, with a macro that clicks and types,
  applications recognised by name, and the module independent of the extension.
  Administrator rights were deemed acceptable.
- **The key technical decision: UI Automation rather than a coordinate macro.**
  Clicking remembered points is fragile (a moved window, a different resolution
  or DPI means data in the wrong field). The agent targets controls by
  `AutomationId` or name and records coordinates as a fallback; learning stores
  both at once. The third fallback is typing into the focused field. Every fill
  is verified by reading it back.
- **Learning mode is a recorder**, as requested ("like an ordinary macro
  program"): the agent observes the form being filled by hand (mouse and keyboard
  hooks) and, on save, replaces the typed values with `{field}` and **merges
  "click a control plus type" into a single `pole` step with a UIA target**,
  automatically promoting the recording into a more durable form. Learning is
  entered with the global shortcut Ctrl+Alt+F9 (a kiosk requirement) and the
  wizard window is always on top.
- **Stack:** C# / .NET 9 WinForms (UIA natively, a tray icon, a single-file
  executable). The profile is a twin of the extension's: `Match` (process plus
  title pattern) → `Parse` (delimited/regex/gs1, the same algorithm and the same
  vectors as the firmware and the extension) → `Kroki`
  (field/text/key/click/pause).
- **A demo application** (`desktop-agent/test-app`): WinForms with two screens,
  shuffled fields, decoys (e-mail, phone), a password field and an "application
  state" panel showing what would really reach a database. The desktop equivalent
  of the extension's demo form.
- **Two real bugs caught by the tests, both worth remembering:**
  1. `ValuePattern.SetValue` on a drop-down list sets the text only: the control
     displays the value, but the application **receives no change event** and
     would save an empty field (the twin of the React trap in the extension). The
     fix: lists are handled by selecting an item (`SelectionItemPattern` after
     expanding), and the read-back asks for the selected item, not the text.
  2. Keyboard events injected with `KEYEVENTF_UNICODE` arrive at the hook with
     `vkCode = VK_PACKET (0xE7)` and the character in `scanCode`; a decoder based
     only on `ToUnicodeEx` lost them. The fix also improves compatibility with
     keyboard emulators.
- **Tests:** 29 unit and 21 e2e against a live application (window recognition,
  control visibility in UIA, filling with verification against the application's
  state, untouched decoys, rejection of a foreign code, no match on a foreign
  window, and **the full path through the hook**: the agent captures a scan in the
  background and the characters do not leak into the application). Diagnostic
  modes: `--okno`, `--drzewo`, `--symuluj`, `--wyslij`, `--hook-test`.
- **Not yet checked:** a physical reader, a manual pass through the learning
  wizard, a real kiosk, applications without UIA. Recorded in the roadmap as 4b.

## 2026-08-24 — release 1.0.0 published and verified

- **The process:** pull request #7 from `develop` to `master`, CI green, merge,
  and the release workflow built and published the tag `v1.0.0` in 1 minute 44
  seconds (with the Pico SDK cache from the CI job). The C firmware version is
  injected from VERSION.md for the first time (`#ifndef` plus
  `target_compile_definitions`), so `ping` and the configurator report 1.0.0
  instead of `0.0.0-dev`.
- **A blocker on the way:** the first CI run failed on the firmware and
  configurator jobs, not because of the code but because the account's
  **artifact storage quota was exhausted** (`Failed to CreateArtifact: storage
  quota has been hit`). Artifact uploads are auxiliary, so they got
  `continue-on-error` and a 7-day retention, and the test package now compiles
  the firmware itself instead of downloading an artifact, because it must not
  depend on the quota.
- **Verification of the published package (downloaded from Releases):** the
  SHA-256 sum matched the published one; 40 of 40 files agreed with
  `SHA256SUMS.txt`; the extension manifest and `device/version.py` both said
  1.0.0; the firmware contained `1.0.0` and no `0.0.0-dev`. **The disk image was
  extracted from the UF2 and parsed** (a UF2 decoder plus the generator's own
  `parse_back`): the label, all 11 files, contents matching the repository. Four
  forms differed byte-wise only in line endings (CRLF locally on Windows versus
  LF from the Linux runner) and were identical after normalisation.

## 2026-08-21 — the release package: production C firmware and the extension together

- **The owner's question, "is the extension built in the release?"** It was (with
  its manifest version from VERSION.md, since the extension was merged), but the
  review found **something worse: the package contained only the CircuitPython
  prototype**. The production variant C UF2, the one with the device disk, was not
  in it at all, even though it had been the production version for a while.
- **The new package structure:** the production firmware (installation is ONE
  step: drag it onto `RPI-RP2`, with the configurator, manuals and test forms
  inside), the extension, a loose copy of the configurator, the manuals, and the
  CircuitPython prototype pushed down into its own subdirectory (its `install.ps1`
  computes paths relative to itself, so it works unchanged). Verified locally: 41
  files, 837 KB.
- **A CI regression found along the way:** the firmware job in `ci.yml` did not
  build the configurator, and since the disk image was added it depends on
  `configurator/dist/index.html`, so the UF2 compilation in CI would have failed.
  Fixed by building the configurator before the firmware, in the same order as
  the release workflow.
- **A safeguard:** `build_release.py` aborts with a readable message when the
  variant C UF2 is missing, so an incomplete package cannot be produced quietly.

## 2026-08-21 — a STOP for consolidation: architecture, capabilities, roadmap

- **Owner's decision:** "it works very well; let us stop and write down the
  architecture, what we can and cannot do, which codes we handle and have
  verified, and the next steps."
- **The architecture document brought up to date:** the MSC disk in the variants
  table plus a section of its own (a FAT12 image from the build, read-only, with
  its contents), the extension in the pipeline with TAB frames and the precedence
  rule, and a "tests and verification" section.
- **A new capability matrix** in three categories (verified on hardware /
  automatically / limits): symbologies physically tested (EAN-13, QR, GS1
  DataMatrix with GS), logical formats (an AI table: 01/17/10/21 supported, the
  rest not, with the fail-safe described), hard limits with the resulting system
  behaviour (ASCII/US, GS over HID, PPN and crypto codes, Shadow DOM, USB
  policies), the parametric limits of variant C, and the known differences
  between C and CircuitPython.
- **A new roadmap** with five areas by priority: closing out 1.0, robustness
  across code formats, hardware productisation, deployment ergonomics, and the
  extension's phase 2. A "frozen or rejected" section keeps old ideas from coming
  back without a reason.

## 2026-08-21 — the learning wizard: confirming a choice, and a step back

- **Owner's requirement:** "after selecting an element there has to be a way to
  confirm the choice and to go back to the previous field; the user must be able
  to correct a mistake." Clicking a field in step 3 no longer advances
  automatically: the selection gets a permanent green outline and the panel waits
  for a decision — **confirm and continue / pick another field / back / skip**.
  Back returns to the previous name with its assignment for re-confirmation or
  change; it also works from the save screen (returning to the last field) and
  from the naming step (returning to the scan). Skip clears an earlier assignment
  of that name.
- The screenshots and the tutorial were updated (the step 3 image now shows the
  confirmation state), and the `npm run shots` scenario clicks Confirm after every
  choice, which keeps the flow alive in the test. The device disk was reflashed
  with the new tutorial.

## 2026-08-21 — the profile learning tutorial (a key feature, per the owner)

- **`docs/LEARNING-PROFILES.md`** — a standalone tutorial of learning mode on a
  full example, the medicine order (a GS1 code off a box, the TAB sequence from
  the production `gs1-datamatrix` profile): five steps with screenshots. The
  images are generated by `npm run shots`, and the scenario disables the page's
  built-in demo profile so that the finale shows the profile that was JUST
  TAUGHT, with its name in the toast. Cross-references from the extension manual,
  the crib sheet in the extension's options and the on-device manual; the file was
  added to the device disk (11 files). A fix to the medicine page: the "the
  scanner will type" description was updated from the `LEK;…` variant to the TAB
  sequence.

## 2026-08-21 — tidying the tests, and extension profile management

- **The device disk layout** (the owner asked for "everything in one place, the
  forms in a subdirectory"): the root holds the readme, the manual, the
  configurator and the test menu, with the forms in their own directory. The
  repository mirrors it (a `git mv`), and the links in the test menu are relative,
  so it behaves identically from the disk and from localhost. The FAT12 generator
  learned **subdirectories** (`.` and `..` entries, a cluster chain for the
  directory, long file names, and a recursive self-test). Verified on hardware
  after flashing.
- **The out-of-the-box scenario** was added to the testing document (section 0):
  seven tests from the test menu on ONE production configuration of the scanner,
  with a table of expected results and a cross-profile test.
- **Extension profile management** (the request was "more editing options, for
  instance renaming"): the list in the options page was rebuilt from a table into
  cards with inline editing — name and address pattern (saved when the field
  loses focus), enable and disable, **ordering with ▲▼** (the first match wins,
  which is now both visible and usable), **Duplicate**, Delete with a
  confirmation, and a frame summary ("TAB frame, 4 segments"). Fields and parsing
  are still edited as JSON or by teaching the profile again. The documentation
  screenshots were regenerated with `npm run shots` (the scenario was rewritten
  onto TAB frames; the old `PRC;…` code would no longer parse against the new
  demo profile). In learning mode, TAB is now buffered like a character, so
  learning from a TAB sequence works.

## 2026-08-21 — the extension captures TAB sequences: no more switching profiles

- **Owner's requirement (from a hardware test):** "if the extension detects a
  profile it should load according to the profile, not according to tabs; I do
  not want the user switching profiles during work." The earlier model, where the
  code had to arrive verbatim so device profiles had to be disabled per page, was
  rejected as unusable.
- **The solution, a TAB frame (`parse.separator: "\t"`):** the scanner stays
  PERMANENTLY in its production configuration (the `pracownik-tab` and
  `gs1-datamatrix` profiles enabled). On a recognised page the extension captures
  the whole series from the scanner INCLUDING THE TABS (`preventDefault`, so focus
  does not jump), reassembles the frame and distributes the fields by name. On
  pages with no profile the TABs work as always (variant A, no regression). The
  precedence rule: the extension beats variant A on recognised pages.
- **Robustness details:** a frame with no prefix carries no "this is ours" marker,
  so the anchors are the EXACT segment count plus optional `parse.segmentPatterns`
  (for example `gtin ^[0-9]{14}$`); a medicine frame is rejected on the employee
  page and vice versa (a cross test in e2e). The first character of a series is
  let through (it may have come from a human) and rolled back from a snapshot
  after a successful parse; auto-repeat (`ev.repeat`) means a human; a captured
  series with no ENTER returns to the page after 350 ms of silence; a lone human
  TAB passes through normally. With prefix profiles the behaviour is unchanged.
- **The effect on the demos:** every test page works on ONE (production) scanner
  configuration, and the `lek-wtyczka` profile (the `LEK;…` frame) was demoted to
  a documented alternative.

## 2026-08-21 — a second variant C demo: a medicine order (the GS1 pipeline and profile switching)

- **The owner's request:** an example showing profiles switching and proving that
  from a medicine scan "the serial number and the expiry date fill in correctly",
  with a code "like the ones on real medicines".
- **The medicine form plus its DataMatrix:** a real **DataMatrix ECC200**
  (generated with pylibdmtx and verified by decoding it back byte for byte) in
  the FMD format: `(01)05909991055172` (a GTIN with a computed check digit),
  `(17)271000` (day "00", demonstrating the end-of-month rule, so `2027-10-31`),
  `(10)A23G05`, a GS separator, `(21)K7L9XW24MQ1R`. The page is an order form with
  shuffled fields, decoys and a page-state panel.
- **The pipeline follows the recommendation in the extension manual** (GS does not
  survive the keyboard): a new **`lek-wtyczka`** profile in `default_config.json`
  (disabled; detection like gs1, gs1 parsing, output a `LEK;{gtin};…` frame plus
  ENTER, the first real use of the `text` action) plus **a second built-in
  extension profile** (delimited on `;`). It conflicts with `gs1-datamatrix` (the
  same detection, earlier in the list), so for the demo that one has to be
  disabled; noted on the page and in the manual.
- **Tests:** the extension's e2e grew to 18 assertions (the medicine scenario plus
  a cross test: an employee frame on the medicine page fills nothing and goes back
  to the page, proving the profiles are separated); 37 unit; the C host test was
  updated (`profile_count == 4`), and 87 C plus 52 Python assertions pass;
  `default_config` is 2830 B against the C limit of 4 KB. A tooling trap:
  pylibdmtx on Python 3.13 needs `pip install setuptools` (no `distutils`).

## 2026-08-21 — an extension bug from the first hardware test: Shift broke the frame

- **Symptom (the owner's test):** scanning `PRC;…` with focus in a field pasted
  `RC;…` (without the `P`) into that field instead of distributing the data.
  **Cause:** the scanner types CAPITAL letters, so HID sends a separate
  `keydown Shift` before every letter, and the wedge treated every non-character
  key as the end of a frame (a reset intended for variant A's TABs). After the `P`
  the buffer was cleared by Shift and the rest went to the page. **Fix:** Shift
  and CapsLock no longer reset the frame.
- **Why the tests missed it:** Playwright's `keyboard.type()` does NOT send a
  separate Shift event for capitals, so synthetic input differs from real HID. The
  e2e scan helper was rewritten to be realistic (an explicit Shift down, press,
  up around capitals); against the old code that realistic test reproduces the bug
  exactly, and against the new one it passes. **A rule for the future: keyboard
  simulations in tests must emit modifier events like real hardware.**

## 2026-08-21 — MSC closed out: the device disk built into the C firmware

- **Owner's decision:** "you plug the reader in and everything has to be inside
  it, with no external factors", which settled the postponed MSC question as a
  yes, in a **read-only** variant: plugging it in exposes a FAT12 disk of 256 KB
  with the configurator, the manual and a readme. The configuration is NOT on the
  disk; it still lives in flash slots reached over CDC, so the disk is purely a
  carrier for tools and there is nothing to break or desynchronise (writes and
  formatting are rejected, `is_writable=false`).
- **Implementation:** `tools/make_msc_image.py`, a FAT12 image generator in pure
  Python (long file names with checksums, deterministic timestamps for a
  reproducible build, and a read-back self-test with its own parser on every
  build); CMake generates `msc_image.c` from the built configurator and the
  `msc_files/` directory, so the on-disk configurator always matches the
  repository; `src/msc_disk.c` holds the TinyUSB callbacks (read10 is a memcpy
  from the image in XIP flash); the descriptors gained an MSC interface and
  `bcdDevice` was bumped so Windows refreshes its descriptor cache.
- **Verified on hardware:** flashing through `rebootBootloader` gives a disk that
  mounts with the right label, the configurator on it is byte for byte identical
  with the repository, the CDC ping works and the configuration in the slots
  survived the flash. The UF2 grew to 642 KB (a 256 KB image inside). Web Serial
  works from `file://`, so a configurator opened straight off the disk connects
  normally.
- **A limitation recorded:** corporate environments that block USB mass storage
  will see the reader with no disk; the keyboard and configuration over CDC still
  work (with the configurator taken from the release package).
- **An extension of it** (feedback: "it is all over the place, put everything in
  one place"): the disk also carries **the complete set of test forms**
  (self-contained, with embedded codes) plus a **menu page** telling you which
  profile to enable per test, so you plug the reader in and test straight from its
  disk with no server and no repository. The file list lives in CMake as
  `MSC_INPUTS`. The extension tests from `file://` need "Allow access to file
  URLs" in Chrome. Verified on hardware: 9 files on the disk, byte for byte with
  the repository.

## 2026-08-21 — the browser extension unfrozen (phase 1)

- **Why it was unfrozen:** the condition set in the decision of 2026-08-20
  ("third-party pages plus an unstable field order") materialised — forms where a
  TAB sequence is too fragile. The scope was deliberately narrow: the user opens a
  specific form, the extension recognises it and picks a profile, and the scan
  lands in the fields by name; **outside a recognised form the extension does
  nothing** (no regression for variants A and B).
- **Transport: a keyboard wedge, not Web Serial (a deliberate decision).** The
  extension does not connect to the device, it listens to the keyboard, because
  the scanner *is* a keyboard. The gain: **zero firmware changes** (it had just
  been stabilised on hardware), no fight over the COM port with the configurator,
  and it works with the factory configuration. The CDC channel (structured data
  straight from the device, a `host` mode plus a heartbeat) stays as a phase 2
  option: it requires firmware changes, so we pay for it only when the wedge turns
  out to be too weak.
- **Recognising a form means the address plus the presence of fields.** A URL
  alone is not enough in a single-page app where several forms live under one
  address. View changes are tracked with a MutationObserver plus polling
  `location`. **Patching `history.pushState` would not work**, because a content
  script has a different JavaScript context than the page.
- **The trap that `fill.js` exists for:** `el.value = "X"` alone does not work in
  React, Vue or Angular; the framework keeps its own state and the form is
  submitted EMPTY despite the visible value. The solution: the native setter from
  the prototype plus `input` and `change` events, a read-back, and
  `execCommand("insertText")` as a fallback on a mismatch. The demo form has a
  "page state" panel that *shows* this, and the e2e test asserts on that state,
  not on `value`.
- **The absence of regressions is structural:** when a frame fails to parse, the
  captured characters go back to the page; a TAB inside a frame ends the capture
  (it is a sequence from a device profile, that is variant A); and a scan is
  recognised by its speed (under 60 ms per character) and the ENTER terminator.
- **GS1 over a keyboard has a limit:** the firmware filters non-printable
  characters, so the GS separator (0x1D) never reaches the extension and the
  variable-length fields (AI 10 and 21) have no boundaries. The workaround: a
  scanner profile that types the fields separated by a visible character plus
  `parse.type: "delimited"` (or `parse.gsChar`).
- **Tests:** 36 unit assertions (delimited/regex/GS1 parsing on the same vectors
  as the firmware, address matching, transformations) plus **10 e2e assertions in
  a real Chromium with the extension loaded** (filling, silence outside a profile,
  handing a foreign code back). Both in CI, with e2e under `xvfb-run`.
- **Distribution:** the release package gets an extension directory with the
  manifest version injected from VERSION.md, installed with "Load unpacked". The
  Chrome Web Store was deliberately skipped (an internal deployment).
- **Postponed to phase 2 (when a need appears):** the CDC transport, heuristic
  field matching without learning, aggregating several scans into one form,
  repeatable rows, and `storage.managed` for policy deployment.
- **Merging with the prototype:** this version (with `src/`, filling by name and
  learning mode) replaces the flat selector-based prototype from the same day (the
  entry below); the prototype's files were deleted while resolving the merge, and
  the bookmarklet stays as a diagnostic.

## 2026-08-21 — the browser extension, a flat prototype (superseded)

- **Owner's decision:** the bookmarklet is "odd, users will not get it", so the
  extension became the production route for variant C, with the bookmarklet kept
  as a diagnostic that needs no installation.
- **`browser-extension/` (Manifest V3, no service worker):** the content script
  was the proven wedge code (the profile computed per keystroke, so it works after
  single-page navigation; the badge only on pages with a profile, and the
  extension completely passive elsewhere), a profiles module with the default
  configuration (8 range pages) plus host and path matching shared with the
  options page, an options editor (globals: prefix and frame fields; profiles:
  host, path, and `selector => template` mappings one per line; JSON import and
  export; restoring defaults) and a popup with a global switch and a link to the
  options. The configuration lives in `chrome.storage.local` and changes apply to
  open tabs without a reload (`storage.onChanged`). The mapping separator is `=>`
  rather than `=`, because attribute selectors contain `=`.
- **Verification:** the content script injected on ParaBank (the fallback path
  without `chrome.storage`, that is a first run) filled 7 of 7 fields and showed
  the badge; the logic is identical to the bookmarklet version tested on five
  pages; `node --check` on all the JavaScript.

## 2026-08-21 — variant C: a bookmarklet (a workaround before the extension)

- **The owner's question, "is the extension required?"** For automation yes, but
  as a workaround a **bookmarklet** was written
  (`test-vectors/bookmarklet.html`): a bookmark script with a wedge listener (the
  `WEB;` prefix, a 9-field semicolon frame, ended by the reader's Enter), profiles
  per hostname and path (a CSS selector to a `{field}` template), a native value
  setter plus `input` and `change` events (React, Angular), matching `select`
  options by value or text, a retry after 600 ms when the fields have not rendered
  yet (single-page apps), and a status badge. The source is inline in the HTML,
  with the bookmark's href built from a `<script type="text/plain">` block, so
  there is a single source of truth. A QR code for the frame is included; it
  matches no profile in the scanner, so it passes through verbatim.
- **Automated test (simulated keystrokes in Chrome):** ParaBank 7 of 7, DemoQA
  (React) 5 of 5 with the values surviving a re-render, the Toolshop register 10
  of 10 (an ISO date plus a country select), DataTables with a live filter, and
  AutomationExercise with the signup form filled and the login one left empty
  (targeting within a form context, with two `name=email` fields). An edge case
  found: a scan right after entering a single-page app hits fields that have not
  rendered, hence the retry in the fill routine.
- **An external range** (a section in the forms document): 8 verified training
  pages with their field selectors; nopCommerce (a queue) and saucedemo (the
  address behind a login) were dropped.
- **A Claude application failure (recorded):** two GPU process crashes while
  rendering pages in the built-in browser panel, plus a single-instance lock on
  restart. Operational conclusion: check external pages in a real Chrome, not in
  the application's panel.

## 2026-08-20 — the configurator in tabs, and screenshots in the documentation

- **The configurator's UI was reworked into tabs** (owner feedback: "the screen is
  too small for this form"): Device / Profiles / Test / Update / Service, with the
  Apply and Save permanently buttons moved onto the tab bar (sticky, always
  visible) because they concern the whole configuration. The validation log sits
  above the tabs, visible regardless of the active one. Entering the Test tab does
  not change the test-mode state.
- **Screenshots of every tab** (taken on a live device with the factory
  configuration) were embedded in the configuration document with a description
  per tab, along with references to the test pages and a "page → what it tests →
  profile" table. The installation guide and the on-device manual were aligned to
  the tab names.
- **A screenshot trap (for posterity):** libraries like modern-screenshot clone
  the DOM, and form state (a checkbox's `checked`, a select's or input's `value`)
  consists of **DOM properties, not attributes**, so the clone reverts to the
  state from the HTML. Before calling `domToPng` the properties have to be
  synchronised into attributes (`toggleAttribute('checked', el.checked)`,
  `selected` on options, `setAttribute('value', …)`), otherwise the screenshot
  shows unticked checkboxes and first options despite the correct state on screen.
- **A hang in `test_e2e.py` at step 3 (reported once), diagnosed and hardened:**
  the hang does not reproduce (steps 1-4 pass on the C firmware, including a
  1.6 KB setConfig and save, reboot and persistence). The only place in the script
  without a time limit was `serial.write()` (pyserial defaults to
  `write_timeout=None`, which blocks forever when the device stops draining data).
  The hardening: `write_timeout=2` plus a `SerialTimeoutException`, so the step
  fails instead of hanging; and on opening the port a lone `\n` is sent along with
  `reset_input_buffer()`, which clears an unfinished line in the firmware's buffer
  left by a previous client (a disconnected configurator, say) and stale data on
  the host side. Verified on hardware after the change.

## 2026-08-20 — full documentation, the device layout, and an e2e script

- **The README** was rewritten as a non-technical description with a table of
  links, and the technical details moved into the architecture document. New
  pages: the configuration guide (the configurator, profiles, the sequence
  mini-language, storage precedence), the forms guide (variants A, B and GS1 plus
  the boundary "third-party pages need an extension") and the testing guide (unit,
  e2e, the test package, the acceptance plan).
- **The file layout on the device (CircuitPython):** `config/config.json`
  (editable; the config path changed, with a fallback to the legacy location), a
  crib sheet for the engineer in `docs/` (its source in `tools/device_docs/`), the
  configurator in the root, and the firmware `*.py` plus `lib/` marked as
  untouchable. The release package builds this layout.
- **`tools/test_e2e.py`** — the production e2e scenario: the device is
  autodetected by ping (it works with both firmware variants), with automated
  steps (getConfig, setConfig plus a read-back, save, reboot and persistence) and
  operator steps (a scan in test mode, a HID write, duplicates); a PASS/FAIL
  report, and the configuration restored afterwards.

## 2026-08-20 — the C firmware passed on hardware

- **An end-to-end test of the C version on the device:** the composite enumerates;
  `ping` reports `impl:"c"`; `setConfig` with the production `default_config.json`
  works; `save` makes the **configuration survive a reboot** (the A/B slots);
  `hidTest` works; form A (a regexGroups profile: first name TAB surname TAB
  number TAB department ENTER) works; the GS1 form (GTIN, ISO date, batch, serial)
  works; EAN passthrough and duplicate blocking work. **The stage criterion is
  met: the same configuration, the same tests, the same result as
  CircuitPython.**
- **A memory collision between CircuitPython and C (recorded):** the C slots sit
  in the last flash sectors, where CircuitPython keeps its NVM, so a `save` in the
  C version overwrites CircuitPython's NVM (going back to CircuitPython, the
  config returns from the file, so the fallback works; the headers differ, so the
  CRC filters out foreign data in both directions).
- **The C version's to-do list before calling it releasable:** test-mode events
  with the profile name and fields, the version injected from VERSION.md at build
  time (it said `0.0.0-dev`), a decision about MSC (the configurator from the
  package works over CDC, so MSC is optional), and a release package for variant C.

## 2026-08-20 — the C firmware, phase 2: the complete pipeline (built, awaiting hardware)

- **New modules:** `mini_regex.c`, a bespoke regex engine with capturing groups (a
  subset of ure: `^ $ . [] * + ? ()` plus the classes `\d\w\s`, optional groups
  `(...)?`, backtracking with a step limit; `{m,n}` and `|` are rejected in
  validation); `config_parse.c` (jsmn, vendored), a full parser and validator of
  the JSON configuration into runtime structures, keeping the raw JSON for
  getConfig and save; `config_flash.c`, **atomic A/B slots** in the last two flash
  sectors (magic, seq, CRC16; writes always go to the opposite slot and the choice
  is made by seq, so an interrupted write does not destroy the previous one); and
  `profile_matcher.c`, detect → parse (regexGroups/gs1) → actions plus the
  passthrough/split/prefix/suffix/onError fallback.
- **`main.c`:** UART0 on GP0/GP1 from the configuration, a 3 s watchdog, duplicate
  blocking (with a refreshed window), the LED on GP6, a factory reset from GP2 at
  startup, test mode (scan events with base64 and hex over CDC) and a pending
  reset once the HID queue drains (`watchdog_reboot` or `reset_usb_boot`).
- **The CDC protocol in C:** the full command set matching the CircuitPython
  version (ping with `impl:"c"`, getConfig returning the preserved raw JSON,
  setConfig parsing, validating and activating, save to flash, factoryReset to
  erase, reboot and rebootBootloader, and hidTest for diagnostics).
- **C host tests: 87 assertions** (the framer, GS1, mini_regex on the real profile
  patterns, config_parse on the production `default_config.json`, and
  profile_matcher end to end: employee, GS1, the EAN fallback, onError, split).
  The UF2 was 111 KB.
- **Deliberate differences from CircuitPython (to decide on at freeze):** the test
  event does not return the profile name or the fields (only the fact of a match),
  and there is no MSC yet. Limits: 6 profiles, 8 fields, 16 actions, a 4 KB
  configuration.
- **Trap of the day:** newlib does not hint at what is missing — `strtol` and
  `atoi` require an explicit `<stdlib.h>` (the same mistake twice).

## 2026-08-20 — CI: unit tests and a test package

- **`ci.yml`** (the owner's decision: pull requests to master plus
  `workflow_dispatch`; a push does NOT trigger CI): four test and build jobs plus a
  test package. The Python tests were consolidated into
  `firmware-circuitpython/tests/test_firmware.py` (52 assertions, no dependencies,
  plain Python); the C tests are `firmware-pico-sdk/tests/test_host.c` with
  `-Werror` (23 assertions); the configurator build doubles as a type check; and
  the UF2 is compiled on Ubuntu (apt `gcc-arm-none-eabi` plus a Pico SDK cache
  through `actions/cache`).
- **The test package:** on demand only (Run workflow, for instance on `develop`
  before a release pull request), producing the full release zip as an
  **artifact**, without publishing.
- Host tests are to be kept in pairs: every logic change in the CircuitPython
  version needs its counterpart in the C vectors.

## 2026-08-20 — the C firmware, phase 1: toolchain and skeleton

- **Toolchain (Windows):** CMake, Ninja, the ARM GNU Toolchain 14.2 (winget),
  WinLibs GCC (for the host tests and picotool) and the Pico SDK 2.x with the
  tinyusb submodule. An SDK 2.x trap: the build ALSO needs a host compiler
  (picotool is built from source); without one, ninja fails with "No
  CMAKE_C_COMPILER".
- **The `firmware-pico-sdk/` skeleton:** a USB CDC plus HID composite on TinyUSB
  (descriptors with an IAD, a unique serial from the board ID, named interfaces,
  and development VID/PID), a non-blocking main loop, the NDJSON protocol (just
  `ping` and `hidTest` at that point) and an HID queue with the full US map.
- **Ports of the pure modules:** `scan_framer.c` (framing with terminators and a
  timeout) and `parser_gs1.c` — **the C host tests pass (23 assertions, the same
  vectors as the CircuitPython tests)**, which was the stage criterion.
- **Build:** a 72 KB UF2 (Release). The `build/` directory is in `.gitignore`.
- **Left for later phases:** the scanner UART and framer integration, the config
  store port (flash, A/B slots for atomic writes; LittleFS was dropped in favour
  of simpler atomicity), profiles and regex, the full CDC protocol, the watchdog,
  MSC with the configurator, and CI for the C build.

## 2026-08-20 — a test on a third-party page, and the decision about an extension

- **A test on a real page (httpbin.org/forms/post):** a profile with the sequence
  `{imie} " " {nazwisko} TAB {numer} TAB "email"` correctly filled three fields of
  a form we have no influence over. Conclusion: **the TAB sequence mode works on
  any page or application**, because the scanner is a keyboard; the conditions are
  a stable field order and clicking the starting field.
- **Filling "by field name" on third-party pages** requires code on the browser
  side (our variant B worked because the page had a listener built in). It cannot
  be done without an extension.
- **Decision: the extension is POSTPONED.** Current needs are covered by (a) TAB
  sequences on any page and (b) a keyboard-wedge script on pages we control. The
  extension comes back on the table if a requirement appears for third-party pages
  plus an unstable field order or filling by name.

## 2026-08-20 — versioning through VERSION.md

- **`VERSION.md` in the root is the only source of the version** (parsed as the
  first X.Y.Z pattern). `firmware-circuitpython/version.py` keeps `0.0.0-dev` in
  the repository, and `build_release.py` generates `device/version.py` with the
  version from VERSION.md when packaging, so a manual deployment from the
  repository is distinguishable from a release by the `-dev` suffix.
- **`CHANGELOG.md` moved to the root** (the release body in CI points at the new
  path).
- **A release happens only when the version was raised:** CI compares VERSION.md
  with `HEAD^1` (the previous master) and checks whether the tag exists; without a
  bump all the release steps are skipped (a green job and no release). The earlier
  guard that failed on an existing tag was replaced by a skip, so a documentation
  merge into master does not require a version bump.

## 2026-08-20 — the installation package and CI

- **Versioning:** a semver version file (starting at 0.9.0); `ping` returns `fw`;
  the configurator shows the version plus a "firmware update" section (the UF2
  steps, a reboot-to-bootloader button and a link to Releases).
- **The release package** (`tools/build_release.py`): the installation guide, the
  installer, `flash/*.uf2`, the `device/` tree (firmware, `lib/adafruit_hid`, the
  configurator) and `SHA256SUMS.txt`; a zip plus a separate `.sha256`. The local
  build was 683 KB across 25 files.
- **The Windows installer (`tools/install.ps1`):** it detects the drives by marker
  files (`INFO_UF2.TXT`, `boot_out.txt`) rather than by `Get-Volume`, because the
  RP2040 bootloader is invisible there; a fresh board gets full provisioning and
  an existing one only has its files replaced (an update). The update path was
  confirmed on the device.
- **CI (`release.yml`):** originally triggered by a `v*` tag; it checks the tag
  against the firmware version, downloads the pinned UF2 and bundle, builds the
  configurator, assembles the package and publishes it to GitHub Releases with the
  changelog.
- **The release process (the owner's decision, no manual tags):** work happens on
  `develop`, and a release is a **merge of a `develop` → `master` pull request**.
  CI (triggered by `pull_request closed` with a merged-from-develop condition)
  reads the version, creates the tag itself and publishes the release. A guard: if
  a release for that version exists, the build stops and asks for a version bump.
  In the release pull request: raise the version and fill in the changelog.
- **User documentation:** the installation guide covers installation, wiring, the
  one-off scanner module setup (Series Output and Induction), the configurator,
  updates, and a table of common problems distilled from building this thing.

## 2026-08-20 — the GS1 parser and the ergonomics core

- **The GS1 parser (`parser_gs1.py`):** AI 01 (a 14-digit GTIN), 17 (YYMMDD into
  the derived field `dataWaznosciISO`; **day 00 means the last day of the month**,
  leap years included), 10 and 21 (variable, up to 20, terminated by GS 0x1D or the
  end of the code). The AIM ID (`]d2` and friends) is stripped and exposed as the
  field `aim`. It works on raw bytes and gives readable errors (an unknown AI, a
  truncated or non-numeric field).
- **The `parse.type="gs1"` profile:** fixed fields
  (gtin, dataWaznosci, dataWaznosciISO, partia, numerSeryjny, aim) usable in action
  sequences. An example `gs1-datamatrix` profile is in `default_config.json`, and
  it was enabled on the device over CDC. **The end-to-end test passed:** a QR with
  a GS separator, scanned off a screen, filled a goods-receipt form with the date
  converted to ISO. The GM65 passes GS 0x1D through with no extra configuration.
- **The ergonomics core:** duplicate blocking (`scanner.duplicateBlockMs`, 1500 by
  default; holding a code in front of the lens refreshes the window, so it is
  typed once), a pause after action keys (`device.actionDelayMs`, 30 by default),
  `output.prefixText` and `output.suffixText`, and `output.onError` raw or skip
  when a profile fails to parse. All of it is in the validator, the configurator
  (new fields plus a parsing-type selector with a hint listing the GS1 fields) and
  the host tests.
- **Deliberately postponed:** Polish and German keyboard layouts. Barcodes are
  ASCII and the US layout covers ASCII one to one; Polish diacritics would need a
  layouts library, to be added when a real need appears.
- **A build-process trap:** `npm run build | tail && cp` — the pipe masks tsc's
  exit code, so deploy only after a clean `npm run build` without a pipe.

## 2026-08-20 — permanent storage and the web configurator

- **Permanent storage:** `microcontroller.nvm` (4 KB on this board), with the
  format magic `BC`, a version, a length, a CRC16-XModem and the JSON; after
  writing it is read back and verified. Source precedence: **NVM →
  `default_config.json` → built-in defaults**; a corrupt NVM (a bad CRC) falls back
  to the file silently. `factoryReset` clears the NVM. A new `reboot` command (a
  soft reset) was added. The end-to-end test: setConfig, save, reboot, and the
  config survived from NVM; factoryReset, reboot, and the file came back. A real
  config is about 600 B, so there is plenty of room.
- **The configurator:** vite plus vanilla TypeScript plus zod plus
  vite-plugin-singlefile, giving **one 72.6 kB file** deployed onto the device.
  Web Serial at 115200, NDJSON with a requestId (a promise per command), and
  sections for the connection, the device, profiles, testing (a preview of scan
  events), saving, import and export, and a service area (factory reset, reboot,
  bootloader). A profile is edited in a sequence mini-language
  (`{field} TAB "text" ENTER`, converted both ways into the action list).
  Validation with zod mirrors the firmware's, including the `{m,n}` block in
  regexes. Saving: "Apply" (RAM) versus "Save permanently" (NVM, verified with
  another getConfig).
- **A bonus, the employee data demo:** a TAB form (the `pracownik-tab` profile in
  `default_config.json`, disabled, with the sequence first name TAB surname TAB
  number TAB department ENTER and a `PRC;…` code) and a by-name form (a keyboard
  wedge in the page's own JavaScript: a frame after the `EMP;` prefix, values
  distributed into fields by `name` regardless of order or focus). The QR codes are
  embedded in the HTML for scanning off the screen. Variant B is the "cooperating
  application" pattern without an extension.
- **Owner's tests, passed:** the configurator connects and writes to NVM; form A
  had the profile fill it with TABs and submit with Enter; form B had the page
  distribute the values by field name from an `EMP;…` frame with the scanner
  working verbatim. UX feedback: the configurator is too technical for an end
  user, so a simple mode goes on the backlog.
- **A UX issue to fix one day:** the Web Serial dialog shows both of the device's
  ports (console and data) without distinguishing them, and the manual says to pick
  the second one; a ping-timeout autodetection with a hint would be better.
- **A Web Serial trap (fixed):** after `port.open()` Chrome does NOT assert DTR,
  and CircuitPython only sends over CDC when DTR is set, so without
  `port.setSignals({dataTerminalReady:true})` every command times out. The same
  applied earlier to .NET's SerialPort. A project rule: every CDC client must set
  DTR explicitly.

## 2026-08-19 — USB CDC and test mode

- **The configuration channel:** `usb_cdc.data` (the second COM port), with the
  NDJSON protocol (`protocol_cdc.py`): one line is one object, responses always
  carry `ok` plus an echoed `requestId`, there is an 8 KB per-line limit with a
  controlled error, and the poll in the main loop is non-blocking.
- **Commands:** `ping`, `getConfig`, `setConfig` (validate, then activate in RAM,
  `persisted:false`), `save` (a stub at that point), `setMode` hid or test,
  `factoryReset` (RAM) and `rebootBootloader`
  (`microcontroller.on_next_reset(RunMode.UF2)` plus a reset after the response is
  sent).
- **Test mode:** a scan does NOT go to HID, it produces an event
  `{"event":"scan","rawBase64","hex","profile","fields"}`. Verified end to end with
  pyserial: commands plus events for two different codes.
- **An observation:** in induction mode the scanner re-reads the same code about
  once a second while it stays in front of the lens, so duplicate blocking will be
  needed.
- **Host tests for the protocol:** a mocked stream (fragmentation, malformed JSON,
  an unknown command, a handler exception, a line overflow) — all pass.
- **The product vision (clarified by the owner):** a plug-and-play device that is
  a keyboard; profiles are sequences of the "3 characters, TAB, TAB, ENTER, the
  rest" kind (the current action format covers that); configuration through a
  configurator page kept on the device's own USB disk plus Web Serial (an RP2040
  has no WiFi, so it cannot host a page over the network); and filling form fields
  BY NAME requires a browser extension, because HID alone cannot do it.

## 2026-08-19 — profiles, validation and induction mode

- **Profiles (`profiles.py`):** three explicit steps, detect (regex) → parse
  (regexGroups into named fields) → output (field/key/text actions). The first
  matching enabled profile wins, and no match falls back to passthrough or split.
  Tested on hardware: a `P005…` code cut into fields, and an EAN passing through
  verbatim.
- **Validation (`config_store.validate`):** the version, a 16 KB limit, unique
  profile names, allowed types, regex correctness, group numbers, the existence of
  fields used in the output, and known keys (with `keys.py` as the single source of
  truth). An invalid configuration falls back to the defaults and prints the list
  of errors, never a restart loop. Factory reset: holding the GP2 button for about
  a second at startup skips the configuration file.
- **A CircuitPython `re` (ure) limitation:** no `{m,n}` quantifiers, so the
  validator rejects patterns with braces; spell them out (`[0-9][0-9][0-9]`).
- **The GM65 command protocol works from the Pico:** the frame
  `7E 00 TYPES 01 ADDR_H ADDR_L DATA CRC16` (a CRC16-XModem computed from the byte
  after `0x7E`). Reading and writing the zone bit plus an EEPROM save were
  confirmed. Zone bit `0x0000`: bits 1-0 are the read mode (00 manual, 01 command,
  10 continuous, 11 sensor), bit 7 the LED, bit 6 the buzzer. Script:
  `firmware-circuitpython/setup_induction.py`.
- **Induction (sensor) mode set permanently** (0xD4 to 0xD7 plus an EEPROM save):
  the scanner reads by itself when a code is presented, with no button.
- **An application artefact:** Notepad++ with autocomplete "eats" a TAB from HID
  (the popup swallows the key), so test in plain notepad; real forms do not have
  the problem. An argument for the pause after TAB and ENTER.

## 2026-08-19 — modules and the action list

- **Firmware structure:** `code.py` (the main loop), `scanner_uart.py` (framing raw
  bytes: terminators from the config OR a silence timeout; GS 0x1D passes through
  untouched), `parser.py` (bytes into an action list; the `passthrough` and `split`
  modes), `output_hid.py` (actions `{"type":"text"|"key"}` into HID; the keys TAB,
  ENTER, ESC, BACKSPACE, arrows and F1-F12; `keyDelayMs` per character, 10 ms by
  default) and `config_store.py` (reads `/default_config.json`, merges it with the
  defaults, and runs on the defaults on error).
- **The action format (shared across the project):**
  `[{"type":"text","value":"..."},{"type":"key","key":"TAB"}]`.
- **Host tests:** the scanner_uart, parser and config_store logic tested on a PC
  with a mocked UART (CR/CRLF/multi-frame/timeout/GS framing, split, filters,
  config merging) — all pass.
- **CircuitPython traps:** there is no `UnicodeDecodeError` (it is `UnicodeError`),
  and an empty frame after CRLF must not swallow the poll call.
- **A hardware episode:** runs of 0x00 bytes (a break on the TX line) plus USB
  momentarily disappearing turned out to be power dips on the adapter contacts;
  pressing them together made it stable. A symptom worth remembering.
- **Result:** the split `P005 → TAB → 8746601261 → ENTER` confirmed in a text
  editor, and the device restored to `passthrough`.

## 2026-08-19 — 10 of 10 scans

- **Problem 1, the scanner did not transmit over UART:** this unit had its output
  switched to USB. The fix: scanning the **"Series Output"** configuration barcode
  from the manufacturer's manual. After that the module transmits TTL 9600 8N1.
- **Problem 2, the frame terminator:** this GM65 ends a frame with **CR (0x0D)
  alone**, with no LF. The code from the instructions splits on LF, so the firmware
  was rewritten to split on CR **or** LF and to close a frame with no terminator
  after 250 ms of silence.
- **Problem 3, robustness:** the first junk byte (0x00) killed the firmware (a
  `ValueError` in `layout.write`). Added: a filter for non-printable characters
  plus a `try/except` around HID.
- **A CircuitPython trap:** `del bytearray[:n]` is not supported (a TypeError), so
  the buffer is `bytes` plus slicing.
- **Diagnostics in the repository:** `diag_baud.py` (stepping through baud rates),
  `diag_baud2.py` (9600 versus 115200), `diag_pins.py` and `diag_findpin.py`
  (electrical activity on the pins) and `hardware/downloads/konsola.py` (listening
  to the CircuitPython console from the host, which needs DTR).
- **Result:** 10 of 10 identical scans of `P0058746601261` in the console and in a
  text editor over USB HID.

## 2026-08-19 — firmware flashed

- **CircuitPython 10.2.1** (the `raspberry_pi_pico` build, deliberately generic so
  it works on a clone regardless of flash size). The 10.x library bundle from
  2026-08-18 (`adafruit_hid`). The installer files are in `hardware/downloads/`.

## 2026-08-19 — the hardware prototype and the schematic

- **UART pins (Pico):** GP0 = TX0 to the scanner's RX, GP1 = RX0 from the
  scanner's TX.
- **Starting baud rate:** 9600 8N1 (the GM65 default). Frame terminator: CR LF.
- **Powering the scanner:** 5 V from the Pico's VBUS pin (pin 40). The GM65
  signals at 3.3 V TTL, but **confirm it in your module's datasheet or with a
  meter before connecting**; if the scanner's TX is at 5 V, add a 1 kΩ / 2 kΩ
  divider (the RP2040's GPIOs are not 5 V tolerant).
- **Optional parts:** a status LED on GP6 (through 330 Ω), a TRIG button on GP2 (to
  ground, with the internal pull-up) and a buzzer on GP7 (eventually through an NPN
  transistor with 1 kΩ to the base).
- **The schematic:** `hardware/wokwi/` (a diagram plus a dummy GM65 as a custom
  chip). Tinkercad was rejected: no Pico and no UART modules in its component
  library.
- **A Wokwi limitation (2026-08):** `machine.UART` does not work on wokwi-pi-pico
  (it hangs in the constructor, and UART0 is taken by the REPL console). The
  simulation is therefore a schematic plus dummy logs in the CHIPS CONSOLE, and
  reception is tested on hardware.
- **Target firmware:** CircuitPython plus adafruit_hid first, with the migration to
  C / Pico SDK plus TinyUSB only after things stabilised.
- **The board, a candidate:** a black RP2040 Pico clone with USB-C (apparently a
  YD-RP2040: BOOT/RST/USR, a WS2812 RGB LED, the Pico pinout). The only board to
  hand with native USB, hence HID. Rejected: a Pi Zero W (Linux, a different
  solution architecture), NodeMCU V3 and ESP-01S (ESP8266, no USB), and the ESP32-C3
  SuperMini and ESP32-C3 OLED (the C3 has no full USB OTG for HID).
- **The level shifter is deliberately absent:** the GM65 is 3.3 V TTL, and a
  1 kΩ / 2 kΩ divider is only for a confirmed 5 V TX (a divider on a 3.3 V line
  would give a marginal 2.2 V).
- **The scanner module (identified from a photo, 2026-08-19):** a GM65/GM805-type
  carrier, with the scan engine on an FPC ribbon and its own buzzer, trigger
  button, LED and LDO regulator (SOT-223) on the board, so 5 V power and 3.3 V UART
  logic. The UART connector is a JST with the silkscreen `GND | RXD | TXD | VCC`.
  **The factory harness uses non-standard colours:** yellow is GND, blue is RXD,
  violet is TXD and green is VCC, so connect by the pin labels, not the colours. A
  check before wiring up the UART: a multimeter from TXD to GND on a powered, idle
  module should read about 3.3 V (an idle UART line sits at logic high).
