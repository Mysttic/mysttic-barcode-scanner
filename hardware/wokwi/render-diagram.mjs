// Zrzut schematu polaczen z Wokwi do dokumentacji (docs/img/wiring-minimal.png).
//
// Otwiera zapisany projekt, czeka na wyrenderowanie czesci i wycina sam uklad
// (bez interfejsu edytora). Dzieki temu obrazek w dokumentacji odtwarza sie
// jednym poleceniem, zamiast recznym eksportem.
//
//   node hardware/wokwi/render-diagram.mjs
//   node hardware/wokwi/render-diagram.mjs <id-projektu> <plik-wyjsciowy>
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
// Playwright jest zaleznoscia wtyczki - stamtad go bierzemy.
const wymagaj = createRequire(join(ROOT, "browser-extension", "package.json"));
const { chromium } = wymagaj("playwright");

const PROJEKT = process.argv[2] || "472807254038722561";
const CEL = process.argv[3] || join(ROOT, "docs", "img", "wiring-minimal.png");
const MARGINES = 24;

const przegladarka = await chromium.launch();
try {
  const strona = await przegladarka.newPage({
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 2, // ostry obrazek do dokumentacji
  });
  await strona.goto(`https://wokwi.com/projects/${PROJEKT}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  // czesci pojawiaja sie dopiero po zbudowaniu sceny
  await strona.waitForSelector('[class*="diagramItem"]', { timeout: 60_000 });
  await strona.waitForTimeout(2500);

  const kadr = await strona.evaluate((margines) => {
    const czesci = [...document.querySelectorAll('[class*="diagramItem"]')];
    const r = czesci.map((e) => e.getBoundingClientRect());
    const x0 = Math.min(...r.map((a) => a.left)) - margines;
    const y0 = Math.min(...r.map((a) => a.top)) - margines;
    const x1 = Math.max(...r.map((a) => a.right)) + margines;
    const y1 = Math.max(...r.map((a) => a.bottom)) + margines;
    return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
  }, MARGINES);

  await strona.screenshot({ path: CEL, clip: kadr });
  console.log(`-> ${CEL} (${Math.round(kadr.width)}x${Math.round(kadr.height)} px @2x)`);
} finally {
  await przegladarka.close();
}
