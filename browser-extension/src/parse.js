// Parsowanie ramki ze skanu na nazwane pola.
// Odpowiednik profiles.py + parser_gs1.py z firmware'u, w wersji przegladarkowej.
//
// Typy parsowania (pole parse.type profilu formularza):
//   delimited - kod ciety separatorem, nazwy kolejnych segmentow ("_" = pomin)
//   regex     - wzorzec z grupami + mapa pole->numer grupy (jak w urzadzeniu)
//   gs1       - parser GS1 (AI 01/17/10/21), pola gtin/dataWaznosci/
//               dataWaznosciISO/partia/numerSeryjny/aim
//
// UWAGA GS1 przez klawiature: firmware filtruje znaki niedrukowalne, wiec
// separator GS (0x1D) NIE przechodzi przez HID. Dla kodow GS1 albo ustaw
// widoczny separator (parse.gsChar), albo - zalecane - zbuduj w urzadzeniu
// profil GS1 wypisujacy pola rozdzielone znakiem i uzyj typu "delimited".
(function () {
  "use strict";

  var GS = String.fromCharCode(0x1d);
  var DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  var FIXED = { "01": ["gtin", 14, true], "17": ["dataWaznosci", 6, true] };
  var VARIABLE = { "10": ["partia", 20], "21": ["numerSeryjny", 20] };

  function isDigits(text) {
    return text.length > 0 && /^[0-9]+$/.test(text);
  }

  // YYMMDD -> YYYY-MM-DD. Dzien "00" = ostatni dzien miesiaca (regula farmaceutyczna).
  function dateToIso(yymmdd) {
    if (!/^[0-9][0-9][0-9][0-9][0-9][0-9]$/.test(yymmdd)) return null;
    var year = 2000 + parseInt(yymmdd.slice(0, 2), 10);
    var mm = parseInt(yymmdd.slice(2, 4), 10);
    var dd = parseInt(yymmdd.slice(4, 6), 10);
    if (mm < 1 || mm > 12) return null;
    if (dd === 0) {
      dd = DAYS[mm - 1];
      if (mm === 2 && year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) dd = 29;
    } else if (dd > 31) {
      return null;
    }
    return (
      String(year).padStart(4, "0") + "-" + String(mm).padStart(2, "0") + "-" + String(dd).padStart(2, "0")
    );
  }

  // AIM ID = "]" + litera + cyfra (np. "]d2") - zdejmowany z poczatku.
  function stripAim(text) {
    if (text.length >= 3 && text[0] === "]") return { text: text.slice(3), aim: text.slice(0, 3) };
    return { text: text, aim: null };
  }

  function parseGs1(text, gsChar) {
    var sep = gsChar || GS;
    var head = stripAim(text);
    var raw = head.text;
    var fields = {};
    var i = 0;
    while (i < raw.length) {
      if (raw[i] === sep) {
        i += 1;
        continue;
      }
      if (i + 2 > raw.length) return { error: "urwany AI na pozycji " + i };
      var ai = raw.slice(i, i + 2);
      i += 2;
      var name;
      var value;
      if (Object.prototype.hasOwnProperty.call(FIXED, ai)) {
        var fixed = FIXED[ai];
        name = fixed[0];
        value = raw.slice(i, i + fixed[1]);
        if (value.length < fixed[1]) return { error: "AI " + ai + ": oczekiwano " + fixed[1] + " znaków" };
        if (fixed[2] && !isDigits(value)) return { error: "AI " + ai + ": oczekiwano samych cyfr" };
        i += fixed[1];
      } else if (Object.prototype.hasOwnProperty.call(VARIABLE, ai)) {
        var variable = VARIABLE[ai];
        name = variable[0];
        var end = raw.indexOf(sep, i);
        if (end < 0) end = raw.length;
        value = raw.slice(i, end);
        if (!value) return { error: "AI " + ai + ": puste pole" };
        if (value.length > variable[1]) return { error: "AI " + ai + ": za długie (>" + variable[1] + ")" };
        i = end;
      } else {
        return { error: "nieobsługiwany AI '" + ai + "' na pozycji " + (i - 2) };
      }
      fields[name] = value;
    }
    if (Object.keys(fields).length === 0) return { error: "pusty kod" };
    if (fields.dataWaznosci) {
      var iso = dateToIso(fields.dataWaznosci);
      if (iso) fields.dataWaznosciISO = iso;
    }
    if (head.aim) fields.aim = head.aim;
    return { fields: fields };
  }

  function parseDelimited(text, spec) {
    var sep = spec.separator || ";";
    var names = spec.fields || [];
    if (!names.length) return { error: "profil nie ma listy pól (parse.fields)" };
    var parts = text.split(sep);
    if (parts.length < names.length) {
      return { error: "kod ma " + parts.length + " segmentów, profil oczekuje " + names.length };
    }
    var fields = {};
    for (var i = 0; i < names.length; i += 1) {
      var name = names[i];
      if (!name || name === "_") continue; // segment celowo pomijany (np. prefiks)
      fields[name] = parts[i];
    }
    return { fields: fields };
  }

  function parseRegex(text, spec) {
    var pattern = spec.pattern || "";
    var re;
    try {
      re = new RegExp(pattern);
    } catch (e) {
      return { error: "błędny wyraz regularny: " + e.message };
    }
    var m = re.exec(text);
    if (!m) return { error: "kod nie pasuje do wzorca profilu" };
    var fields = {};
    var map = spec.fields || {};
    for (var name in map) {
      if (!Object.prototype.hasOwnProperty.call(map, name)) continue;
      var group = m[map[name]];
      if (group === undefined) return { error: "brak grupy " + map[name] + " dla pola " + name };
      fields[name] = group;
    }
    return { fields: fields };
  }

  // Czy ramka w ogole wyglada na "nasza" - decyduje o przechwyceniu skanu.
  function matchesPrefix(text, spec) {
    if (!spec || !spec.prefix) return true;
    return text.indexOf(spec.prefix) === 0;
  }

  // Zwraca {fields} albo {error}. Wejscie: tekst ramki bez terminatora.
  function parseFrame(text, spec) {
    if (typeof text !== "string" || !text) return { error: "pusta ramka" };
    if (!spec || !spec.type) return { error: "profil bez parse.type" };
    if (!matchesPrefix(text, spec)) return { error: "ramka nie zaczyna się od '" + spec.prefix + "'" };
    if (spec.type === "delimited") return parseDelimited(text, spec);
    if (spec.type === "regex") return parseRegex(text, spec);
    if (spec.type === "gs1") return parseGs1(text, spec.gsChar);
    return { error: "nieznany typ parsowania: " + spec.type };
  }

  globalThis.BRParse = {
    parseFrame: parseFrame,
    matchesPrefix: matchesPrefix,
    dateToIso: dateToIso,
    stripAim: stripAim,
  };
})();
