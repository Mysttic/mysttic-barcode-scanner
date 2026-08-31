# Desktop agent (an independent module)

The counterpart of the browser extension for **desktop applications**: it sits in
the system tray, recognises an application window, captures the scan from the
reader and replays a macro it was taught (fields, clicks, keystrokes).

The module is **completely independent** of the extension and of the firmware.
The scanner works in its ordinary USB keyboard mode with no configuration
changes.

User manual: [docs/DESKTOP-AGENT.md](../docs/DESKTOP-AGENT.md).

The code and the user interface are in Polish; see the note in
[CONTRIBUTING.md](../CONTRIBUTING.md).

## File layout

| File | Role |
|---|---|
| `src/CzytnikAgent/Native.cs` | Win32: hooks, SendInput, windows, the global shortcut |
| `src/CzytnikAgent/Model.cs` | the application profile and its JSON store (`%APPDATA%\MystticBarcodeScanner`) |
| `src/CzytnikAgent/ParserSkanu.cs` | frame to named fields (`delimited`, `regex`, `gs1`), a port of the extension and firmware parser |
| `src/CzytnikAgent/Uia.cs` | UI Automation: finding controls, typing, reading values back |
| `src/CzytnikAgent/Makro.cs` | replaying steps (UIA → coordinates → the focused field) |
| `src/CzytnikAgent/Wedge.cs` | the keyboard hook, recognising a scan by its speed, handing characters back |
| `src/CzytnikAgent/Nagrywarka.cs` | recording the operator's actions as macro steps |
| `src/CzytnikAgent/OknoNauki.cs` | the wizard: scan → segment names → recording → save |
| `src/CzytnikAgent/TrayApp.cs` | the tray icon, its menu, the Ctrl+Alt+F9 shortcut |
| `src/CzytnikAgent/Log.cs` | the activity log (`%APPDATA%\MystticBarcodeScanner\agent.log`) |
| `test-app/` | the demo application (WinForms): a login screen and an employee card |
| `tests/TestyAgenta/` | unit tests (parser, patterns, the recorder) |
| `tests/test_e2e.py` | e2e tests against a live application and real UI Automation |

## Building

```bash
dotnet build -c Release desktop-agent/src/CzytnikAgent
```

```bash
dotnet build -c Release desktop-agent/test-app
```

The executables are `MystticBarcodeAgent.exe` and `MystticDemoApp.exe`.

## Tests

```bash
dotnet run -c Release --project desktop-agent/tests/TestyAgenta
```

```bash
python desktop-agent/tests/test_e2e.py
```

Unit: 34 assertions (the parser on the same vectors as the firmware and the
extension, window matching, merging recorded steps). E2E: 27 assertions against a
real WinForms application — window recognition, control visibility in UIA,
filling through a macro with verification against the application's state,
untouched decoy fields, rejection of a foreign code, plus **the full path through
the hook** (the agent in the background capturing a scan, including one in the
style of a real reader with Shift and capitals) and **profile reloading without a
restart**.

## Release

```bash
python tools/build_release.py --skip-npm
```

The release package gets a `desktop-agent/` directory (the standalone
`MystticBarcodeAgent.exe`, the `install-agent.ps1` installer, an example profile
and the manual), and next to it a separate `demo-app-v<version>-win-x64.zip` with
the portable demo application. Both executables are built **self-contained**, so
the customer does not have to install .NET.

The package is normally built on Linux (that is what CI does), where .NET still
produces the Windows executables thanks to `EnableWindowsTargeting`. Ready-made
`.exe` files can also be passed in with `--agent-exe` and `--app-testowa-exe`. A
quick local build without the agent: `--bez-agenta`.

The screenshots for the manual (`docs/img/agent-*.png`) are regenerated with:

```bash
MystticBarcodeAgent.exe --zrzuty ..\..\docs\img --proces MystticDemoApp
```

with the demo application running. The scenario walks through the wizard live, so
the images do not drift away from the code.

## Diagnostic modes

```bash
MystticBarcodeAgent.exe --okno --proces MystticDemoApp
```

```bash
MystticBarcodeAgent.exe --drzewo --proces MystticDemoApp
```

```bash
MystticBarcodeAgent.exe --symuluj "PRC;JAN;KOWALSKI;12345;IT" --proces MystticDemoApp --profile file.json
```

`--drzewo` prints the controls seen by UI Automation (this is how you check
whether an application can be targeted by identifiers at all), `--symuluj`
replays a macro without a scanner, `--wyslij` impersonates the scanner (for
tests), and `--hook-test` checks that the keyboard hook receives events.
