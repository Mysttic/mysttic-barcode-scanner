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
const { toIsoDate, toIsoDateTime, toTime, normalizeText, formatDate, applyTransforms, looksLikeDate, selectorOf, specOf } =
  globalThis.BRFill;

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
checkTrue("url: gwiazdka w srodku", urlMatches("*form-c-extension.html*", "file:///C:/repo/test-vectors/forms/form-c-extension.html#/pracownik"));
checkTrue("url: pelna sciezka", urlMatches("https://erp.firma.pl/magazyn/*", "https://erp.firma.pl/magazyn/przyjecie"));
checkTrue("url: inna domena odrzucona", !urlMatches("https://erp.firma.pl/*", "https://zla.firma.pl/magazyn"));
checkTrue("url: kropka nie jest metaznakiem", !urlMatches("https://a.b/*", "https://axb/c"));
checkTrue("url: pusty wzorzec", !urlMatches("", "https://a.b/"));

// ---------------------------------------------- ramki TAB-owe (bez prefiksu) ---
const TABSPEC = {
  type: "delimited",
  separator: "\t",
  fields: ["imie", "nazwisko", "numer", "dzial"],
  segmentPatterns: { numer: "^[0-9]+$" },
};
check("tab-frame: sekwencja urzadzenia na pola",
  parseFrame("JAN\tKOWALSKI\t12345\tIT", TABSPEC).fields,
  { imie: "JAN", nazwisko: "KOWALSKI", numer: "12345", dzial: "IT" });
checkTrue("tab-frame: bez prefiksu wymagana DOKLADNA liczba segmentow",
  !!parseFrame("JAN\tKOWALSKI\t12345\tIT\tEXTRA", TABSPEC).error);
checkTrue("tab-frame: za malo segmentow odrzucone",
  !!parseFrame("JAN\tKOWALSKI", TABSPEC).error);
checkTrue("tab-frame: wzorzec segmentu odsiewa cudza ramke (lek na pracowniku)",
  !!parseFrame("05909991055172\t2027-10-31\tA23G05\tK7L9XW24MQ1R", TABSPEC).error);

const state = defaults();
check("profile: demo pasuje do strony testowej", candidatesForUrl(state, "http://localhost:8124/form-c-extension.html").length, 1);
check("profile: demo leku pasuje do swojej strony", candidatesForUrl(state, "http://localhost:8124/form-c-medicine.html").length, 1);
check("profile: obca strona bez profilu", candidatesForUrl(state, "https://example.com/").length, 0);
state.profiles[0].enabled = false;
check("profile: wylaczony pomijany", candidatesForUrl(state, "http://localhost:8124/form-c-extension.html").length, 0);
check("stan: normalizacja pustego wejscia", normalize(null).profiles.length, 2);
check("stan: nieznane pola nie kasuja ustawien", normalize({ settings: { burstGapMs: 90 } }).settings.minFrameLength, 3);

// ------------------------------------------------- format wartosci wyjsciowej ---
check("format: GS1 RRMMDD -> DD.MM.RRRR", formatDate("271231", "DD.MM.RRRR"), "31.12.2027");
check("format: ISO -> DD.MM.RRRR", formatDate("2027-12-31", "DD.MM.RRRR"), "31.12.2027");
check("format: PL -> ISO", formatDate("31.12.2027", "RRRR-MM-DD"), "2027-12-31");
check("format: rok dwucyfrowy", formatDate("271231", "RR/MM/DD"), "27/12/31");
check("format: bez separatorow", formatDate("271231", "RRRRMMDD"), "20271231");
check("format: tokeny angielskie", formatDate("271231", "DD/MM/YYYY"), "31/12/2027");
check("format: RRRRMMDD na wejsciu", formatDate("20271231", "DD.MM.RRRR"), "31.12.2027");
check("format: dzien 00 = koniec miesiaca", formatDate("270200", "DD.MM.RRRR"), "28.02.2027");
check("format: nie-data zostaje bez zmian", formatDate("KOWALSKI", "DD.MM.RRRR"), "KOWALSKI");
check("format: bledny miesiac to nie data", formatDate("271331", "DD.MM.RRRR"), "271331");
check("format: brak wzorca nic nie zmienia", formatDate("271231", ""), "271231");

// --- wzorce dowolne: wielkosc liter, tokeny bez zera wiodacego, literaly ---
check("wzorzec: male litery (dd-mm-yy)", formatDate("2027-10-31", "dd-mm-yy"), "31-10-27");
check("wzorzec: male litery z yyyy", formatDate("271231", "dd/mm/yyyy"), "31/12/2027");
check("wzorzec: bez zera wiodacego", formatDate("2027-02-01", "D.M.RRRR"), "1.2.2027");
check("wzorzec: mieszana wielkosc liter", formatDate("2027-10-31", "Dd.mM.rRrR"), "31.10.2027");
check("wzorzec: tekst w apostrofach", formatDate("2027-10-31", "DD.MM.RRRR 'r.'"), "31.10.2027 r.");
check("wzorzec: apostrof w tekscie", formatDate("2027-10-31", "''RRRR"), "'2027");
check("wzorzec: niedomkniety apostrof nie wywala", formatDate("2027-10-31", "DD 'reszta"), "31 reszta");
check("wzorzec: same separatory", formatDate("2027-10-31", "RRRRMMDD"), "20271031");

// --- czas ------------------------------------------------------------------
check("czas: ISO z godzina", formatDate("2027-10-31 14:05", "RRRR-MM-DD HH:MI"), "2027-10-31 14:05");
check("czas: ISO z literka T", formatDate("2027-10-31T14:05:09", "HH:MI:SS"), "14:05:09");
check("czas: sekundy dopelniane zerem", formatDate("2027-10-31 14:05", "HH:MI:SS"), "14:05:00");
check("czas: data PL z godzina", formatDate("31.10.2027 09:30", "RRRR-MM-DD HH:MI"), "2027-10-31 09:30");
check("czas: 12 cyfr RRRRMMDDHHMM", formatDate("202710311405", "DD.MM.RRRR HH:MI"), "31.10.2027 14:05");
check("czas: 10 cyfr RRMMDDHHMM (GS1)", formatDate("2710311405", "DD.MM.RRRR HH:MI"), "31.10.2027 14:05");
check("czas: sam czas", formatDate("14:05", "HH:MI"), "14:05");
check("czas: godzina bez zera wiodacego", formatDate("2027-10-31 09:05", "H:MI"), "9:05");
check("czas: bledna godzina to nie data", formatDate("2027-10-31 25:00", "HH:MI"), "2027-10-31 25:00");
check("czas: sam czas nie udaje daty", formatDate("14:05", "DD.MM.RRRR"), "14:05");
check("czas: data bez czasu daje zera", formatDate("2027-10-31", "HH:MI"), "00:00");

// Regula minut: MM to miesiac, chyba ze wczesniej we wzorcu byla godzina.
check("minuty: mm po godzinie", formatDate("2027-10-31 14:05", "HH:mm"), "14:05");
check("minuty: MM bez godziny to miesiac", formatDate("2027-10-31 14:05", "DD-MM-RRRR"), "31-10-2027");
check("minuty: data po czasie wraca do miesiaca", formatDate("2027-10-31 14:05", "HH:mm DD.MM.RRRR"), "14:05 31.10.2027");
check("minuty: MI jest jednoznaczne", formatDate("2027-10-31 14:05", "MI"), "05");

check("kontrolka datetime-local", toIsoDateTime("31.10.2027 14:05"), "2027-10-31T14:05");
check("kontrolka time", toTime("2027-10-31 14:05"), "14:05");
check("kontrolka time z samego czasu", toTime("9:07"), "09:07");
check("kontrolka date z datetime", toIsoDate("2027-10-31 14:05"), "2027-10-31");

check("data wyglada na date", looksLikeDate("271231"), true);
check("czas wyglada na wartosc czasowa", looksLikeDate("14:05"), true);
check("numer pracownika to nie data", looksLikeDate("12345"), false);
check("szescocyfrowy numer bez sensownej daty", looksLikeDate("123456"), false);

check("transform: GTIN-14 -> EAN-13", applyTransforms("05901234567890", { transform: ["gtin13"] }), "5901234567890");
check("transform: GTIN-13 bez zmian", applyTransforms("5901234567890", { transform: ["gtin13"] }), "5901234567890");
check("transform: wielkie litery", applyTransforms("kowalski", { transform: ["upper"] }), "KOWALSKI");
check("transform: same cyfry", applyTransforms("A-22/B", { transform: ["digits"] }), "22");
check("transform: prefiks i sufiks", applyTransforms("7", { transform: ["prefix:LOT-", "suffix:/2027"] }), "LOT-7/2027");
check("transform: wyciecie fragmentu", applyTransforms("05901234567890", { transform: ["slice:1,6"] }), "59012");
check("transform: format i lancuch razem", applyTransforms("271231", { format: "DD.MM.RRRR", transform: ["digits"] }), "31122027");
check("transform: brak specyfikacji nic nie robi", applyTransforms("A22", {}), "A22");
check("transform: nieznana operacja pomijana", applyTransforms("A22", { transform: ["bzdura"] }), "A22");

check("pole jako selektor", selectorOf("input[name=x]"), "input[name=x]");
check("pole jako obiekt", selectorOf({ selector: "#x", format: "DD.MM.RRRR" }), "#x");
check("spec z selektora tekstowego jest pusta", specOf("input[name=x]"), {});
check("spec z obiektu zachowana", specOf({ selector: "#x", format: "RRRR-MM-DD" }).format, "RRRR-MM-DD");

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
