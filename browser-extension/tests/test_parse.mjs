// Testy hostowe wtyczki: parsowanie ramek, dopasowanie adresow, transformacje.
// Bez zaleznosci - uruchamiane tym samym stylem co testy firmware'u:
//   node browser-extension/tests/test_parse.mjs
import { readFileSync } from "node:fs";

const here = new URL(".", import.meta.url);
for (const file of ["parse.js", "fill.js", "store.js"]) {
  const source = readFileSync(new URL("../src/" + file, here), "utf8");
  new Function(source)();
}

const { parseFrame, dateToIso, stripAim, matchesPrefix } = globalThis.BRParse;
const { urlMatches, candidatesForUrl, defaults, normalize } = globalThis.BRStore;
const { toIsoDate, normalizeText } = globalThis.BRFill;

const GS = String.fromCharCode(0x1d);
let passed = 0;
const failures = [];

function check(name, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) passed += 1;
  else failures.push(`${name}\n    oczekiwano: ${e}\n    otrzymano:  ${a}`);
}

function checkTrue(name, value) {
  check(name, !!value, true);
}

// ------------------------------------------------------------- delimited ---
const PRACOWNIK = {
  type: "delimited",
  prefix: "PRC;",
  separator: ";",
  fields: ["_", "imie", "nazwisko", "numer", "dzial"],
};

check("delimited: kod pracownika", parseFrame("PRC;JAN;KOWALSKI;12345;IT", PRACOWNIK).fields, {
  imie: "JAN",
  nazwisko: "KOWALSKI",
  numer: "12345",
  dzial: "IT",
});
checkTrue("delimited: obcy prefiks odrzucony", !!parseFrame("EMP;ANNA;NOWAK;1;HR", PRACOWNIK).error);
checkTrue("delimited: za malo segmentow", !!parseFrame("PRC;JAN;KOWALSKI", PRACOWNIK).error);
check("delimited: puste segmenty zachowane", parseFrame("PRC;JAN;;12345;IT", PRACOWNIK).fields.nazwisko, "");
checkTrue("delimited: nadmiarowe segmenty ida do kosza", !parseFrame("PRC;A;B;C;D;E;F", PRACOWNIK).error);

// ----------------------------------------------------------------- regex ---
const REGEX_SPEC = {
  type: "regex",
  pattern: "^P([0-9][0-9][0-9])([0-9]+)$",
  fields: { naglowek: 1, numer: 2 },
};
check("regex: grupy do pol", parseFrame("P0058746601261", REGEX_SPEC).fields, {
  naglowek: "005",
  numer: "8746601261",
});
checkTrue("regex: brak dopasowania", !!parseFrame("XYZ", REGEX_SPEC).error);
checkTrue("regex: bledny wzorzec nie wywala", !!parseFrame("abc", { type: "regex", pattern: "([" }).error);

// ------------------------------------------------------------------- GS1 ---
const GS1 = { type: "gs1" };
check("gs1: pelny kod", parseFrame("010590123456789017271231" + GS + "10A22" + GS + "21SN7", GS1).fields, {
  gtin: "05901234567890",
  dataWaznosci: "271231",
  partia: "A22",
  numerSeryjny: "SN7",
  dataWaznosciISO: "2027-12-31",
});
check("gs1: AIM zdejmowany", parseFrame("]d20105901234567890", GS1).fields, {
  gtin: "05901234567890",
  aim: "]d2",
});
check("gs1: dzien 00 = koniec miesiaca", parseFrame("010590123456789017270200", GS1).fields.dataWaznosciISO, "2027-02-28");
check("gs1: dzien 00 w roku przestepnym", parseFrame("010590123456789017280200", GS1).fields.dataWaznosciISO, "2028-02-29");
checkTrue("gs1: nieznany AI", !!parseFrame("9912345", GS1).error);
checkTrue("gs1: urwany GTIN", !!parseFrame("0112345", GS1).error);
checkTrue("gs1: GTIN musi byc cyframi", !!parseFrame("01ABCDEFGHIJKLMN", GS1).error);
check("gs1: widoczny separator zamiast GS", parseFrame("0105901234567890|10A22", { type: "gs1", gsChar: "|" }).fields, {
  gtin: "05901234567890",
  partia: "A22",
});

check("data: zwykla", dateToIso("271231"), "2027-12-31");
check("data: bledny miesiac", dateToIso("271331"), null);
check("data: nie-cyfry", dateToIso("27AB31"), null);
check("aim: brak", stripAim("0105901234567890").aim, null);
checkTrue("prefiks: brak prefiksu = zawsze pasuje", matchesPrefix("cokolwiek", { type: "delimited" }));

// ------------------------------------------------------- dopasowanie URL ---
checkTrue("url: gwiazdka w srodku", urlMatches("*forma-c-wtyczka.html*", "file:///C:/repo/test-vectors/forma-c-wtyczka.html#/pracownik"));
checkTrue("url: pelna sciezka", urlMatches("https://erp.firma.pl/magazyn/*", "https://erp.firma.pl/magazyn/przyjecie"));
checkTrue("url: inna domena odrzucona", !urlMatches("https://erp.firma.pl/*", "https://zla.firma.pl/magazyn"));
checkTrue("url: kropka nie jest metaznakiem", !urlMatches("https://a.b/*", "https://axb/c"));
checkTrue("url: pusty wzorzec", !urlMatches("", "https://a.b/"));

const state = defaults();
check("profile: demo pasuje do strony testowej", candidatesForUrl(state, "http://localhost:8124/forma-c-wtyczka.html").length, 1);
check("profile: obca strona bez profilu", candidatesForUrl(state, "https://example.com/").length, 0);
state.profiles[0].enabled = false;
check("profile: wylaczony pomijany", candidatesForUrl(state, "http://localhost:8124/forma-c-wtyczka.html").length, 0);
check("stan: normalizacja pustego wejscia", normalize(null).profiles.length, 1);
check("stan: nieznane pola nie kasuja ustawien", normalize({ settings: { burstGapMs: 90 } }).settings.minFrameLength, 3);

// ------------------------------------------------------------ wypelnianie ---
check("data PL -> ISO", toIsoDate("31.12.2027"), "2027-12-31");
check("data ISO bez zmian", toIsoDate("2027-12-31"), "2027-12-31");
check("data z kreskami", toIsoDate("1-2-2027"), "2027-02-01");
check("tekst bez ogonkow", normalizeText("  Dzial Glowny "), "dzial glowny");
check("tekst z ogonkami", normalizeText("Księgowość"), "ksiegowosc");

// ------------------------------------------------------------------ raport ---
if (failures.length) {
  console.error(`FAIL: ${failures.length} z ${passed + failures.length} asercji`);
  failures.forEach((f) => console.error("  - " + f));
  process.exit(1);
}
console.log(`OK: ${passed} asercji`);
