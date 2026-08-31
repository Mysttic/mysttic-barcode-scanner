# Third-party notices

Mysttic Barcode Scanner is licensed under the Apache License 2.0 (see
[LICENSE](LICENSE)). Parts of the source tree and of the published release
packages come from other projects and stay under their own licenses. This file
lists them.

## Bundled in the source tree

| Component | Where | License | Copyright |
|---|---|---|---|
| [jsmn](https://github.com/zserge/jsmn) | `firmware-pico-sdk/src/vendor/jsmn.h` | MIT | Copyright (c) 2010 Serge Zaitsev |
| [CircuitPython](https://github.com/adafruit/circuitpython) firmware image | `hardware/downloads/circuitpython-pico-*.uf2` | MIT | Copyright (c) Adafruit Industries and CircuitPython contributors |
| [Adafruit CircuitPython HID](https://github.com/adafruit/Adafruit_CircuitPython_HID) | `hardware/downloads/extracted/*/lib/adafruit_hid/*.mpy` | MIT | Copyright (c) Adafruit Industries |

The two Adafruit artefacts are pinned binaries, kept so that the CircuitPython
prototype can be built without network access. CI downloads the same versions
from the URLs in `.github/workflows/*.yml`.

## Linked into the production firmware (`mysttic_barcode_scanner.uf2`)

| Component | License | Copyright |
|---|---|---|
| [Raspberry Pi Pico SDK](https://github.com/raspberrypi/pico-sdk) | BSD-3-Clause | Copyright (c) 2020 Raspberry Pi (Trading) Ltd. |
| [TinyUSB](https://github.com/hathach/tinyusb) (via the Pico SDK) | MIT | Copyright (c) 2018 hathach (tinyusb.org) |

## Shipped inside the release package

| Component | Where in the package | License | Copyright |
|---|---|---|---|
| [CircuitPython](https://github.com/adafruit/circuitpython) | `circuitpython-prototype/flash/*.uf2` | MIT | Copyright (c) Adafruit Industries and CircuitPython contributors |
| [Adafruit CircuitPython HID](https://github.com/adafruit/Adafruit_CircuitPython_HID) | `circuitpython-prototype/device/lib/adafruit_hid/*.mpy` | MIT | Copyright (c) Adafruit Industries |
| [.NET runtime](https://github.com/dotnet/runtime) | statically included in `MystticBarcodeAgent.exe` and `MystticDemoApp.exe` (self-contained publish) | MIT | Copyright (c) .NET Foundation and Contributors |

## Build-time only (not redistributed)

[TypeScript](https://github.com/microsoft/TypeScript) (Apache-2.0),
[Vite](https://github.com/vitejs/vite) (MIT),
[vite-plugin-singlefile](https://github.com/richardtallent/vite-plugin-singlefile) (MIT),
[Playwright](https://github.com/microsoft/playwright) (Apache-2.0),
[zod](https://github.com/colinhacks/zod) (MIT, bundled into `configurator.html`).

## Hardware documentation

The GM65 scanner module is a third-party product. Its datasheet and command
manual are copyrighted by the manufacturer and are **not** redistributed here;
see [docs/HARDWARE.md](docs/HARDWARE.md) for where to obtain them.

## License texts

### MIT License

```
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### BSD 3-Clause License

```
Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this
   list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice,
   this list of conditions and the following disclaimer in the documentation
   and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors
   may be used to endorse or promote products derived from this software
   without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

The Apache License 2.0 text used by TypeScript and Playwright is the same as
the project's own license, in [LICENSE](LICENSE).
