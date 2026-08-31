// Rasteryzuje brand/icon.svg do wszystkich rozmiarow, ktorych wymagaja
// wtyczka, konfigurator i aplikacje desktopowe.
//
//   node brand/make_icons.mjs
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
// playwright jest zainstalowany przy wtyczce - stamtad go bierzemy
const wymagaj = createRequire(join(ROOT, "browser-extension", "package.json"));
const { chromium } = wymagaj("playwright");
const SVG = readFileSync(join(ROOT, "brand", "icon.svg"), "utf8");

// gdzie ma trafic ikona w danym rozmiarze
const CELE = {
  16: [["browser-extension", "icons", "icon-16.png"]],
  32: [["browser-extension", "icons", "icon-32.png"]],
  48: [["browser-extension", "icons", "icon-48.png"]],
  128: [["browser-extension", "icons", "icon-128.png"],
        ["brand", "icon-128.png"]],
  256: [["brand", "icon-256.png"]],
};
// Konfigurator jest JEDNYM plikiem HTML (dziala prosto z dysku czytnika),
// wiec ikona musi siedziec w nim jako data URI, nie obok jako plik.
const KONFIGURATOR = join(ROOT, "configurator", "index.html");

const przegladarka = await chromium.launch();
try {
  let ikona32 = null;
  for (const [rozmiar, sciezki] of Object.entries(CELE)) {
    const px = Number(rozmiar);
    const strona = await przegladarka.newPage({
      viewport: { width: px, height: px },
      deviceScaleFactor: 1,
    });
    await strona.setContent(
      `<body style="margin:0">${SVG.replace(/width="\d+" height="\d+"/, `width="${px}" height="${px}"`)}</body>`,
    );
    const png = await strona.screenshot({ omitBackground: true });
    if (px === 32) ikona32 = png.toString("base64");
    for (const czesci of sciezki) {
      const plik = join(ROOT, ...czesci);
      mkdirSync(join(ROOT, ...czesci.slice(0, -1)), { recursive: true });
      writeFileSync(plik, png);
      console.log(`  ${px}px -> ${czesci.join("/")}`);
    }
    await strona.close();
  }

  let html = readFileSync(KONFIGURATOR, "utf8");
  html = html
    .replace(/(rel="icon" type="image\/png" href="data:image\/png;base64,)[^"]*(")/, `$1${ikona32}$2`)
    .replace(/(id="brand-icon" src="data:image\/png;base64,)[^"]*(")/, `$1${ikona32}$2`);
  writeFileSync(KONFIGURATOR, html);
  console.log("  32px -> configurator/index.html (data URI)");
} finally {
  await przegladarka.close();
}
console.log("Ikony gotowe. Plik .ico dla aplikacji: python brand/make_ico.py");
