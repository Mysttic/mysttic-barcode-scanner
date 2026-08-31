// Zrzuty ekranu konfiguratora do dokumentacji (docs/img/configurator-*.png).
//
// Konfigurator rozmawia z czytnikiem przez WebSerial, wiec zeby zrobic zrzuty
// BEZ SPRZETU podstawiamy `navigator.serial` atrapa urzadzenia: mowi tym samym
// protokolem NDJSON co firmware i oddaje produkcyjny default_config.json.
// Dzieki temu obrazki w dokumentacji odtwarza kazdy, jednym poleceniem, i nie
// rozjezdzaja sie z interfejsem.
//
//   node configurator/tests/screenshots.mjs      (na serwerze: xvfb-run -a ...)
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
// Playwright jest zaleznoscia wtyczki (tam sluzy do testow e2e) - bierzemy go
// stamtad zamiast trzymac druga kopie przy konfiguratorze.
const wymagaj = createRequire(join(ROOT, "browser-extension", "package.json"));
const { chromium } = wymagaj("playwright");
const STRONA = pathToFileURL(join(ROOT, "configurator", "dist", "index.html")).href;
const IMG = join(ROOT, "docs", "img");
const KONFIGURACJA = JSON.parse(
  readFileSync(join(ROOT, "firmware-circuitpython", "default_config.json"), "utf8"),
);

// Atrapa urzadzenia wstrzykiwana przed skryptami strony.
function atrapaUrzadzenia(config) {
  const enkoder = new TextEncoder();
  let wyslij = null;
  const odpowiedz = (obj) => wyslij?.(enkoder.encode(JSON.stringify(obj) + "\n"));

  const port = {
    readable: new ReadableStream({
      start(c) {
        wyslij = (bytes) => c.enqueue(bytes);
      },
    }),
    writable: new WritableStream({
      write(chunk) {
        const tekst = new TextDecoder().decode(chunk);
        for (const linia of tekst.split("\n").filter((l) => l.trim())) {
          const zadanie = JSON.parse(linia);
          const id = zadanie.requestId;
          switch (zadanie.cmd) {
            case "ping":
              odpowiedz({ ok: true, requestId: id, fw: "1.1.0", version: 1, mode: "hid", impl: "c" });
              break;
            case "getConfig":
              odpowiedz({ ok: true, requestId: id, config, persisted: true });
              break;
            case "setConfig":
            case "save":
            case "setMode":
            case "factoryReset":
              odpowiedz({ ok: true, requestId: id });
              break;
            default:
              odpowiedz({ ok: false, requestId: id, error: "nieznana komenda" });
          }
        }
      },
    }),
    open: async () => {},
    close: async () => {},
    setSignals: async () => {},
    addEventListener: () => {},
  };

  Object.defineProperty(navigator, "serial", {
    configurable: true,
    value: {
      requestPort: async () => port,
      getPorts: async () => [port],
      addEventListener: () => {},
    },
  });

  // Skan w trybie testowym: dokladnie taki event, jaki wysyla firmware.
  globalThis.__skan = (raw, profil, pola) =>
    odpowiedz({
      event: "scan",
      rawBase64: btoa(raw),
      hex: [...raw].map((z) => z.charCodeAt(0).toString(16).padStart(2, "0")).join(" "),
      profile: profil,
      fields: pola,
    });
}

const przegladarka = await chromium.launch();
try {
  const strona = await przegladarka.newPage({ viewport: { width: 1100, height: 520 } });
  await strona.addInitScript(atrapaUrzadzenia, KONFIGURACJA);
  await strona.goto(STRONA);
  await strona.click("#btn-connect");
  await strona.waitForSelector("#sec-device:not([hidden])");
  await strona.waitForTimeout(400);

  // Fabrycznie wszystkie profile sa wylaczone; scenariusz z TESTING.md kaze
  // wlaczyc dwa produkcyjne - zrzuty pokazuja stan po tym kroku.
  await strona.click('button[data-tab="sec-profiles"]');
  await strona.waitForSelector("#sec-profiles:not([hidden])");
  for (const nazwa of ["gs1-datamatrix", "pracownik-tab"]) {
    await strona.evaluate((n) => {
      const pole = [...document.querySelectorAll("#sec-profiles input[type=text]")]
        .find((i) => i.value === n);
      const karta = pole?.closest(".profile, .karta, fieldset, section, div");
      const chk = karta?.querySelector("input[type=checkbox]");
      if (chk && !chk.checked) chk.click();
    }, nazwa);
  }
  await strona.waitForTimeout(200);

  const zakladki = [
    ["sec-device", "device"],
    ["sec-profiles", "profiles"],
    ["sec-test", "test"],
    ["sec-update", "update"],
    ["sec-actions", "service"],
  ];

  for (const [sekcja, nazwa] of zakladki) {
    await strona.click(`button[data-tab="${sekcja}"]`);
    await strona.waitForSelector(`#${sekcja}:not([hidden])`);
    if (sekcja === "sec-test") {
      // wlaczamy tryb testowy i pokazujemy dwa skany, zeby log nie byl pusty
      await strona.click("#chk-testmode");
      await strona.waitForTimeout(200);
      await strona.evaluate(() =>
        globalThis.__skan("PRC;JAN;KOWALSKI;12345;IT", "pracownik-tab", {
          imie: "JAN", nazwisko: "KOWALSKI", numer: "12345", dzial: "IT",
        }));
      await strona.evaluate(() => globalThis.__skan("5901234123457", null, {}));
    }
    await strona.waitForTimeout(300);
    // fullPage: kadr rosnie z trescia (zakladka Profile jest wyzsza niz okno)
    await strona.screenshot({ path: join(IMG, `configurator-${nazwa}.png`), fullPage: true });
    console.log("  ->", `docs/img/configurator-${nazwa}.png`);
  }
} finally {
  await przegladarka.close();
}
console.log("Zrzuty konfiguratora gotowe.");
