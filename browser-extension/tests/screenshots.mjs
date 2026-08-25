// Zrzuty ekranu do dokumentacji (docs/img/wtyczka-*.png).
// Robione na zywo: Chromium z zaladowanym rozszerzeniem przechodzi ten sam
// scenariusz, co operator - skan formularza i pelny tryb nauki.
//
//   node browser-extension/tests/screenshots.mjs      (na serwerze: xvfb-run -a ...)
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const EXT = join(ROOT, "browser-extension");
const IMG = join(ROOT, "docs", "img");
const PYTHON = process.platform === "win32" ? "python" : "python3";
const PORT = 8138;
// Sekwencja TAB-owa, ktora WYPISUJE produkcyjny profil pracownik-tab czytnika:
const RAMKA = "JAN\tKOWALSKI\t12345\tIT";
const STRONA = `http://127.0.0.1:${PORT}/formularze/forma-c-wtyczka.html`;

const serwer = spawn(PYTHON, ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
  cwd: join(ROOT, "test-vectors"),
  stdio: "ignore",
});
const userDataDir = mkdtempSync(join(tmpdir(), "br-shots-"));
let context;

async function shot(target, nazwa) {
  await target.screenshot({ path: join(IMG, `wtyczka-${nazwa}.png`) });
  console.log("  ->", `docs/img/wtyczka-${nazwa}.png`);
}

// Jak prawdziwy HID: Shift przy wielkich literach, "\t" = klawisz TAB.
async function skanuj(page, tekst) {
  for (const ch of tekst) {
    if (ch === "\t") {
      await page.keyboard.press("Tab");
    } else if (/[A-Z]/.test(ch)) {
      await page.keyboard.down("Shift");
      await page.keyboard.press("Key" + ch);
      await page.keyboard.up("Shift");
    } else {
      await page.keyboard.type(ch);
    }
  }
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
}

try {
  await new Promise((r) => setTimeout(r, 700));
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1180, height: 820 },
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });

  let [worker] = context.serviceWorkers();
  if (!worker) worker = await context.waitForEvent("serviceworker");
  const extId = new URL(worker.url()).host;

  const page = context.pages()[0] || (await context.newPage());
  await page.goto(`${STRONA}#/pracownik`);
  await page.waitForSelector("input[name=imie]");
  await page.waitForTimeout(700);

  // 1-2. rozpoznany formularz: przed i po skanie
  await shot(page, "formularz-przed");
  await skanuj(page, RAMKA);
  await shot(page, "formularz-po");

  // 3-6. tryb nauki, krok po kroku
  await page.reload();
  await page.waitForSelector("input[name=imie]");
  await page.waitForTimeout(700);

  // Bez uprawnienia "tabs" nie da sie filtrowac po adresie - bierzemy aktywna
  // karte zwyklego okna (jest tylko jedna).
  const tabId = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true, windowType: "normal" });
    return tabs[0].id;
  });
  await worker.evaluate((id) => chrome.tabs.sendMessage(id, { cmd: "learn" }), tabId);
  await page.waitForTimeout(400);
  await shot(page, "nauka-1-skan");

  await skanuj(page, RAMKA);
  await page.waitForTimeout(300);
  const nazwy = ["imie", "nazwisko", "numer", "dzial"];
  for (let i = 0; i < nazwy.length; i += 1) {
    await page.fill(`input[data-idx="${i}"]`, nazwy[i]);
  }
  await shot(page, "nauka-2-segmenty");

  await page.click('button[data-act="names"]');
  await page.waitForTimeout(300);
  await page.hover("input[name=imie]"); // podswietlenie pola pod kursorem
  await page.waitForTimeout(200);
  await shot(page, "nauka-3-pola");

  for (const selektor of ["input[name=imie]", "input[name=nazwisko]", "input[name=numer]", "select[name=dzial]"]) {
    await page.click(selektor);
    await page.waitForTimeout(200);
    await page.click('button[data-act="confirm"]'); // klik wybiera, przycisk zatwierdza
    await page.waitForTimeout(200);
  }
  await shot(page, "nauka-4-zapis");

  await page.click('button[data-act="save"]');
  await page.waitForTimeout(600);

  // 7. lista profili (po nauce sa dwa: demo + wlasnie nauczony)
  const opcje = await context.newPage();
  await opcje.setViewportSize({ width: 1180, height: 900 });
  await opcje.goto(`chrome-extension://${extId}/src/options.html`);
  await opcje.waitForTimeout(500);
  await shot(opcje, "opcje");
  await opcje.close();

  // 8-9. popup dla strony z profilem i bez profilu
  async function popup(nazwa) {
    await worker.evaluate(
      ({ id }) => chrome.windows.create({ url: `chrome-extension://${id}/src/popup.html`, type: "popup", width: 340, height: 260 }),
      { id: extId },
    );
    const okno = await context.waitForEvent("page");
    await okno.waitForLoadState();
    await okno.setViewportSize({ width: 320, height: 215 }); // realny rozmiar popupu
    await okno.waitForTimeout(600);
    await shot(okno, nazwa);
    await okno.close();
  }

  await page.bringToFront();
  await popup("popup");

  await page.click("#nav-ustawienia");
  await page.waitForSelector("input[name=motyw]");
  await page.waitForTimeout(900);
  await page.bringToFront();
  await popup("popup-bez-profilu");

  // 10-14. samouczek NAUKA-PROFILU.md: nauka profilu na formularzu leku.
  // Wylaczamy wbudowany profil demo-lek, zeby koncowe zrzuty pokazywaly
  // dzialanie profilu NAUCZONEGO w tym scenariuszu, nie fabrycznego.
  const RAMKA_LEK = "05909991055172\t2027-10-31\tA23G05\tK7L9XW24MQ1R";
  const opc = await context.newPage();
  await opc.goto(`chrome-extension://${extId}/src/options.html`);
  await opc.waitForTimeout(400);
  await opc.evaluate(() =>
    BRStore.load().then((s) => {
      s.profiles.forEach((p) => { if (p.id === "demo-lek") p.enabled = false; });
      return BRStore.save(s);
    }),
  );
  await opc.close();

  const lek = await context.newPage();
  await lek.setViewportSize({ width: 1180, height: 820 });
  await lek.goto(`http://127.0.0.1:${PORT}/formularze/forma-c-lek.html`);
  await lek.waitForSelector("input[name=gtin]");
  await lek.waitForTimeout(700);
  await lek.bringToFront();

  const lekTabId = await worker.evaluate(async () => {
    const tabs = await chrome.tabs.query({ active: true, windowType: "normal" });
    return tabs[0].id;
  });
  await worker.evaluate((id) => chrome.tabs.sendMessage(id, { cmd: "learn" }), lekTabId);
  await lek.waitForTimeout(400);
  await shot(lek, "nauka-lek-1-start");

  await skanuj(lek, RAMKA_LEK);
  await lek.waitForTimeout(300);
  const nazwyLek = ["gtin", "dataWaznosci", "partia", "numerSeryjny"];
  for (let i = 0; i < nazwyLek.length; i += 1) {
    await lek.fill(`input[data-idx="${i}"]`, nazwyLek[i]);
  }
  await shot(lek, "nauka-lek-2-segmenty");

  await lek.click('button[data-act="names"]');
  await lek.waitForTimeout(300);
  // zrzut pokazuje stan POTWIERDZANIA: pole kliknięte, panel z Zatwierdź/Wybierz inne/Wstecz
  await lek.click("input[name=gtin]");
  await lek.waitForTimeout(250);
  await shot(lek, "nauka-lek-3-pola");
  await lek.click('button[data-act="confirm"]');
  await lek.waitForTimeout(200);

  // Data: panel potwierdzania dokłada rząd przycisków z podglądem formatów.
  // Tu zatwierdzamy bez zmiany (profil z samouczka ma zostawiać ISO).
  await lek.click("input[name=dataWaznosci]");
  await lek.waitForTimeout(250);
  await shot(lek, "format-daty");
  await lek.click('button[data-act="confirm"]');
  await lek.waitForTimeout(200);

  for (const sel of ["input[name=partia]", "input[name=numerSeryjny]"]) {
    await lek.click(sel);
    await lek.waitForTimeout(200);
    await lek.click('button[data-act="confirm"]');
    await lek.waitForTimeout(200);
  }
  await lek.fill('input[data-field="name"]', "Zamówienie leku — mój profil");
  await shot(lek, "nauka-lek-4-zapis");

  await lek.click('button[data-act="save"]');
  await lek.waitForTimeout(700);
  await skanuj(lek, RAMKA_LEK);
  await shot(lek, "nauka-lek-5-dziala");
  await lek.close();
} finally {
  if (context) await context.close();
  serwer.kill();
  rmSync(userDataDir, { recursive: true, force: true });
}
console.log("Zrzuty gotowe.");
