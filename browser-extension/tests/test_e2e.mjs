// Test e2e wtyczki: prawdziwy Chromium z zaladowanym rozszerzeniem, prawdziwe
// zdarzenia klawiatury (czytnik = klawiatura), prawdziwy formularz demo.
//
// Uruchomienie:
//   npx playwright install chromium
//   node browser-extension/tests/test_e2e.mjs
//
// Sprawdza trzy rzeczy, ktorych testy jednostkowe nie ruszaja:
//   1. rozpoznany formularz  -> skan rozlozony po nazwach pol,
//      a strona (jej wlasny stan) FAKTYCZNIE widzi wartosci,
//   2. widok bez profilu     -> wtyczka milczy, skan wpisuje sie jak z klawiatury,
//   3. obcy kod na rozpoznanym formularzu -> nic nie zjedzone, tekst oddany stronie.
import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
// EXT_DIR pozwala sprawdzic wtyczke z GOTOWEJ paczki wydania, nie z repo.
const EXT = process.env.EXT_DIR || join(ROOT, "browser-extension");
const PYTHON = process.platform === "win32" ? "python" : "python3";
const PORT = 8137;
const KOD = "PRC;JAN;KOWALSKI;12345;IT";
// To samo, co WYPISUJE produkcyjny profil employee-tab w czytniku:
const RAMKA_PRAC = "JAN\tKOWALSKI\t12345\tIT";

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed += 1;
  else failures.push(`${name}\n    oczekiwano: ${e}\n    otrzymano:  ${a}`);
}

// Czytnik wysyla znaki szybciej niz czlowiek - to odroznia skan od pisania.
// WIELKIE litery wpisujemy jak prawdziwy HID: osobny keydown Shift przed
// kazda litera (keyboard.type() tego nie robi i maskowal blad z resetem ramki).
// "\t" w tekscie = nacisniecie TAB (sekwencja z profilu urzadzenia).
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

const serwer = spawn(PYTHON, ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
  cwd: join(ROOT, "test-vectors"),
  stdio: "ignore",
});
const userDataDir = mkdtempSync(join(tmpdir(), "br-ext-"));
let context;

try {
  await new Promise((r) => setTimeout(r, 700));
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const page = await context.newPage();

  // --- 1. rozpoznany formularz: przechwycenie SEKWENCJI TAB-OWEJ ----------
  // Czytnik zostaje w produkcyjnej konfiguracji (profil employee-tab wlaczony)
  // - wtyczka przechwytuje TAB-y i rozklada pola po nazwach.
  await page.goto(`http://127.0.0.1:${PORT}/forms/form-c-extension.html#/employee`);
  await page.waitForSelector("input[name=firstName]");
  await page.waitForTimeout(600); // content script wstaje i dopasowuje profil
  await skanuj(page, RAMKA_PRAC);

  check("firstName", await page.inputValue("input[name=firstName]"), "JAN");
  check("lastName", await page.inputValue("input[name=lastName]"), "KOWALSKI");
  check("number", await page.inputValue("input[name=number]"), "12345");
  check("department (select po wartosci)", await page.inputValue("select[name=department]"), "IT");
  check("pulapka e-mail nietknieta", await page.inputValue("input[name=email]"), "");
  check("pulapka telefon nietknieta", await page.inputValue("input[name=phone]"), "");

  // Najwazniejsze: czy STRONA zobaczyla wartosci (zdarzenia input/change),
  // czy tylko my podmienilismy .value.
  const stanStrony = await page.evaluate(() => globalThis.model);
  check("stan strony po skanie", stanStrony, { firstName: "JAN", lastName: "KOWALSKI", number: "12345", department: "IT" });

  // --- 2. widok bez profilu ----------------------------------------------
  // Wtyczka spi, wiec TAB-y z czytnika NORMALNIE skacza po polach - dokladnie
  // tak, jak bez wtyczki (wariant A bez regresji).
  await page.click("#nav-settings");
  await page.waitForSelector("input[name=theme]");
  await page.waitForTimeout(800); // SPA: wtyczka musi zauwazyc zmiane widoku
  await page.click("input[name=theme]");
  await skanuj(page, "JAN\tKOWALSKI"); // 2 segmenty - tyle, ile pol ma ten widok
  check("bez profilu TAB-y dzialaja normalnie (pole 1)", await page.inputValue("input[name=theme]"), "JAN");
  check("bez profilu TAB-y dzialaja normalnie (pole 2)", await page.inputValue("input[name=language]"), "KOWALSKI");

  // --- 3. obcy kod na rozpoznanym formularzu ------------------------------
  await page.click("#nav-employee");
  await page.waitForSelector("input[name=email]");
  await page.waitForTimeout(800);
  await page.click("input[name=email]");
  await skanuj(page, "EMP;ANNA;NOWAK;67890;HR");
  check("obcy kod oddany stronie", await page.inputValue("input[name=email]"), "EMP;ANNA;NOWAK;67890;HR");
  check("obcy kod nie wypelnil pol", await page.inputValue("input[name=firstName]"), "");

  // --- 4. przelaczanie profili: druga strona = drugi profil ----------------
  // Produkcyjny profil gs1-datamatrix w czytniku wypisuje sekwencje TAB-owa -
  // tu wpisujemy dokladnie to, co wyszloby z czytnika.
  const RAMKA_LEK = "05909991055172\t2027-10-31\tA23G05\tK7L9XW24MQ1R";
  await page.goto(`http://127.0.0.1:${PORT}/forms/form-c-medicine.html`);
  await page.waitForSelector("input[name=gtin]");
  await page.waitForTimeout(600);

  // Najpierw krzyzowo: ramka PRACOWNIKA na stronie LEKU ma zostac odrzucona
  // (wzorce segmentow) i oddana stronie - profile nie strzelaja na krzyz.
  await page.click("input[name=name]");
  await skanuj(page, RAMKA_PRAC);
  check("lek: ramka pracownika nie wypelnia pol leku", await page.inputValue("input[name=gtin]"), "");
  check("lek: ramka pracownika oddana stronie", (await page.inputValue("input[name=name]")).startsWith("JAN"), true);

  await page.click("body");
  await skanuj(page, RAMKA_LEK);

  check("lek: gtin", await page.inputValue("input[name=gtin]"), "05909991055172");
  check("lek: data waznosci (dzien 00 -> koniec miesiaca)", await page.inputValue("input[name=expiry]"), "2027-10-31");
  check("lek: batch", await page.inputValue("input[name=batch]"), "A23G05");
  check("lek: numer seryjny", await page.inputValue("input[name=serial]"), "K7L9XW24MQ1R");
  const stanLek = await page.evaluate(() => globalThis.model);
  check("lek: stan strony po skanie", stanLek,
    { gtin: "05909991055172", expiry: "2027-10-31", batch: "A23G05", serial: "K7L9XW24MQ1R" });

  // --- 5. wartosc wychodzaca w formacie formularza -------------------------
  // Ten sam skan, ale profil dostraja wartosci: data ma trafic jako
  // DD.MM.RRRR, a GTIN-14 jako 13-cyfrowy EAN. Profil wstrzykujemy do
  // magazynu wtyczki, zeby nie ruszac profili demonstracyjnych.
  let worker = context.serviceWorkers()[0];
  if (!worker) worker = await context.waitForEvent("serviceworker");
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      state: {
        version: 1,
        enabled: true,
        profiles: [
          {
            id: "e2e-formaty",
            name: "Formaty (e2e)",
            enabled: true,
            match: { urlPattern: "*form-c-medicine.html*", requiredFields: ["gtin", "expiry"] },
            parse: {
              type: "delimited",
              separator: "\t",
              fields: ["gtin", "expiry", "batch", "serial"],
              segmentPatterns: { gtin: "^[0-9]{14}$" },
            },
            fields: {
              gtin: { selector: "input[name=gtin]", transform: ["gtin13"] },
              expiry: { selector: "input[name=expiry]", format: "dd-mm-yy" },
              batch: "input[name=batch]",
            },
            after: { action: "none" },
          },
        ],
      },
    });
  });
  await page.reload();
  await page.waitForSelector("input[name=gtin]");
  await page.waitForTimeout(700);
  await skanuj(page, RAMKA_LEK);

  check("formaty: wlasny wzorzec dd-mm-yy", await page.inputValue("input[name=expiry]"), "31-10-27");
  check("formaty: GTIN-14 -> EAN-13", await page.inputValue("input[name=gtin]"), "5909991055172");
  check("formaty: batch bez przeksztalcen", await page.inputValue("input[name=batch]"), "A23G05");
  const stanFormaty = await page.evaluate(() => globalThis.model);
  check("formaty: strona widzi przeliczone wartosci", stanFormaty.expiry, "31-10-27");
} finally {
  if (context) await context.close();
  serwer.kill();
  rmSync(userDataDir, { recursive: true, force: true });
}

if (failures.length) {
  console.error(`FAIL: ${failures.length} z ${passed + failures.length} asercji`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`OK: ${passed} asercji e2e`);
