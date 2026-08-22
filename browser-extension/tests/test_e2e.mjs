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

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const EXT = join(ROOT, "browser-extension");
const PORT = 8137;
const KOD = "PRC;JAN;KOWALSKI;12345;IT";

let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed += 1;
  else failures.push(`${name}\n    oczekiwano: ${e}\n    otrzymano:  ${a}`);
}

// Czytnik wysyla znaki szybciej niz czlowiek - to odroznia skan od pisania.
async function skanuj(page, tekst) {
  await page.keyboard.type(tekst, { delay: 5 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
}

const serwer = spawn("python3", ["-m", "http.server", String(PORT), "--bind", "127.0.0.1"], {
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

  // --- 1. rozpoznany formularz -------------------------------------------
  await page.goto(`http://127.0.0.1:${PORT}/forma-c-wtyczka.html#/pracownik`);
  await page.waitForSelector("input[name=imie]");
  await page.waitForTimeout(600); // content script wstaje i dopasowuje profil
  await skanuj(page, KOD);

  check("imie", await page.inputValue("input[name=imie]"), "JAN");
  check("nazwisko", await page.inputValue("input[name=nazwisko]"), "KOWALSKI");
  check("numer", await page.inputValue("input[name=numer]"), "12345");
  check("dzial (select po wartosci)", await page.inputValue("select[name=dzial]"), "IT");
  check("pulapka e-mail nietknieta", await page.inputValue("input[name=email]"), "");
  check("pulapka telefon nietknieta", await page.inputValue("input[name=telefon]"), "");

  // Najwazniejsze: czy STRONA zobaczyla wartosci (zdarzenia input/change),
  // czy tylko my podmienilismy .value.
  const stanStrony = await page.evaluate(() => globalThis.model);
  check("stan strony po skanie", stanStrony, { imie: "JAN", nazwisko: "KOWALSKI", numer: "12345", dzial: "IT" });

  // --- 2. widok bez profilu ----------------------------------------------
  await page.click("#nav-ustawienia");
  await page.waitForSelector("input[name=motyw]");
  await page.waitForTimeout(800); // SPA: wtyczka musi zauwazyc zmiane widoku
  await page.click("input[name=motyw]");
  await skanuj(page, KOD);
  check("bez profilu skan wpisuje sie surowo", await page.inputValue("input[name=motyw]"), KOD);

  // --- 3. obcy kod na rozpoznanym formularzu ------------------------------
  await page.click("#nav-pracownik");
  await page.waitForSelector("input[name=email]");
  await page.waitForTimeout(800);
  await page.click("input[name=email]");
  await skanuj(page, "EMP;ANNA;NOWAK;67890;HR");
  check("obcy kod oddany stronie", await page.inputValue("input[name=email]"), "EMP;ANNA;NOWAK;67890;HR");
  check("obcy kod nie wypelnil pol", await page.inputValue("input[name=imie]"), "");
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
