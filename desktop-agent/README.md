# Desktop agent

The counterpart of the browser extension for **Windows applications**: recognises
a window, captures the scan and replays a macro it was taught. Optional and
independent of the extension and the firmware.

- **User manual, profile format and diagnostics:**
  [docs/desktop-agent.md](../docs/desktop-agent.md)
- **Building and testing:** [docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md)

Code and user interface are in Polish; see the note in
[docs/CONTRIBUTING.md](../docs/CONTRIBUTING.md#a-note-on-language).

| File | Role |
|---|---|
| `src/CzytnikAgent/Native.cs` | Win32: hooks, SendInput, windows, the global shortcut |
| `src/CzytnikAgent/Model.cs` | the application profile and its JSON store |
| `src/CzytnikAgent/ParserSkanu.cs` | frame to named fields, a port of the firmware parser |
| `src/CzytnikAgent/Uia.cs` | UI Automation: finding controls, typing, reading values back |
| `src/CzytnikAgent/Makro.cs` | replaying steps (UIA, then coordinates, then the focused field) |
| `src/CzytnikAgent/Wedge.cs` | the keyboard hook and scan recognition |
| `src/CzytnikAgent/Nagrywarka.cs`, `OknoNauki.cs` | recording the operator and the learning wizard |
| `test-app/` | the demo application used by the tests |
