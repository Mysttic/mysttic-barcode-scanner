// Wstawianie wartosci do pol formularza.
//
// PULAPKA, dla ktorej ten plik istnieje: samo `el.value = "X"` nie dziala na
// stronach w React/Vue/Angular. Framework trzyma wlasna kopie stanu i nie
// zauwaza podmiany, wiec formularz zapisze sie PUSTY mimo widocznej wartosci.
// Dlatego: natywny setter z prototypu + zdarzenia input/change, a gdy odczyt
// zwrotny sie nie zgadza - awaryjnie execCommand("insertText"), ktore generuje
// prawdziwe zdarzenia wejscia.
//
// Drugi obowiazek tego pliku: dostosowanie WARTOSCI WYCHODZACEJ do formularza
// (format daty, przyciecie GTIN itp.) - patrz applyTransforms.
(function () {
  "use strict";

  var TRUTHY = ["1", "true", "tak", "yes", "y", "on"];

  function nativeSetter(el) {
    var proto = HTMLInputElement.prototype;
    if (el instanceof HTMLTextAreaElement) proto = HTMLTextAreaElement.prototype;
    else if (el instanceof HTMLSelectElement) proto = HTMLSelectElement.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, "value");
    return desc && desc.set ? desc.set : null;
  }

  function setNativeValue(el, value) {
    var setter = nativeSetter(el);
    if (setter) setter.call(el, value);
    else el.value = value;
  }

  function fire(el, names) {
    names.forEach(function (name) {
      el.dispatchEvent(new Event(name, { bubbles: true }));
    });
  }

  function normalizeText(text) {
    return String(text)
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // ------------------------------------------------------- data i czas ----

  function zakres(x, min, max) {
    return x >= min && x <= max;
  }

  function zbuduj(y, m, d, hh, mi, ss) {
    if (!zakres(m, 1, 12) || !zakres(d, 1, 31)) return null;
    var czas = hh !== undefined && hh !== null && hh !== "";
    var h = czas ? Number(hh) : 0;
    var n = czas ? Number(mi) : 0;
    var sek = ss === undefined || ss === null || ss === "" ? 0 : Number(ss);
    if (czas && (!zakres(h, 0, 23) || !zakres(n, 0, 59) || !zakres(sek, 0, 59))) return null;
    return { y: y, m: m, d: d, h: h, mi: n, s: sek, maDate: true, maCzas: czas };
  }

  function zbudujCzas(hh, mi, ss) {
    var h = Number(hh);
    var n = Number(mi);
    var sek = ss === undefined || ss === null || ss === "" ? 0 : Number(ss);
    if (!zakres(h, 0, 23) || !zakres(n, 0, 59) || !zakres(sek, 0, 59)) return null;
    return { y: 0, m: 0, d: 0, h: h, mi: n, s: sek, maDate: false, maCzas: true };
  }

  // Rozpoznaje wszystko, co moze przyjsc z kodu albo z profilu urzadzenia:
  // RRRR-MM-DD (takze z godzina po spacji lub "T"), DD.MM.RRRR (z / i -),
  // RRRRMMDD, RRMMDD z GS1, ich odpowiedniki z czasem (10/12 cyfr) oraz sam
  // czas HH:MM[:SS]. Zwraca null, gdy to nie jest data ani czas.
  function parseDateTime(value) {
    var v = String(value == null ? "" : value).trim();
    var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(v))) {
      return zbuduj(+m[1], +m[2], +m[3], m[4], m[5], m[6]);
    }
    if ((m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})(?:[T ](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(v))) {
      return zbuduj(+m[3], +m[2], +m[1], m[4], m[5], m[6]);
    }
    if ((m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(v))) return zbudujCzas(m[1], m[2], m[3]);
    if (/^\d{8}$/.test(v)) return zbuduj(+v.slice(0, 4), +v.slice(4, 6), +v.slice(6, 8));
    if (/^\d{12}$/.test(v)) {
      return zbuduj(+v.slice(0, 4), +v.slice(4, 6), +v.slice(6, 8), v.slice(8, 10), v.slice(10, 12));
    }
    if (/^\d{6}$/.test(v) || /^\d{10}$/.test(v)) {
      // RRMMDD z GS1 - w tym dzien "00" (= ostatni dzien miesiaca). Regula
      // siedzi w parserze kodow, zeby nie miec jej w dwoch miejscach.
      var iso = globalThis.BRParse && globalThis.BRParse.dateToIso(v.slice(0, 6));
      if (!iso) return null;
      return zbuduj(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10), v.slice(6, 8), v.slice(8, 10));
    }
    return null;
  }

  function looksLikeDate(value) {
    return parseDateTime(value) !== null;
  }

  // Tokeny wzorca (dopasowanie bez rozroznienia wielkosci liter, najdluzszy
  // pasuje pierwszy). Minuty maja wlasny token MI, bo MM w calym swiecie
  // znaczy raz miesiac, raz minuty - patrz regula ponizej.
  var TOKENY = [
    ["RRRR", "rok4"], ["YYYY", "rok4"],
    ["RR", "rok2"], ["YY", "rok2"],
    ["MI", "min"],
    ["MM", "miesiac2"], ["M", "miesiac"],
    ["DD", "dzien2"], ["D", "dzien"],
    ["HH", "godzina2"], ["H", "godzina"],
    ["SS", "sekunda2"], ["S", "sekunda"],
  ];

  function dwie(n) {
    return String(n).padStart(2, "0");
  }

  function wartoscTokenu(pole, t) {
    switch (pole) {
      case "rok4": return String(t.y).padStart(4, "0");
      case "rok2": return String(t.y).padStart(4, "0").slice(2);
      case "miesiac2": return dwie(t.m);
      case "miesiac": return String(t.m);
      case "dzien2": return dwie(t.d);
      case "dzien": return String(t.d);
      case "godzina2": return dwie(t.h);
      case "godzina": return String(t.h);
      case "min": return dwie(t.mi);
      case "sekunda2": return dwie(t.s);
      case "sekunda": return String(t.s);
      default: return "";
    }
  }

  // Wzorzec wyjsciowy, np. "DD-MM-RR", "RRRR-MM-DD HH:MI", "D.M.RRRR 'godz.' HH".
  // Tekst w apostrofach przechodzi doslownie ('' = pojedynczy apostrof).
  // REGULA MINUT: MM to miesiac; jesli jednak we wzorcu wystapila wczesniej
  // godzina, PIERWSZE nastepne MM czytamy jako minuty (bo "HH:mm" znaczy to
  // samo wszedzie). Jednoznaczny zapis minut to MI.
  // Wartosc, ktora nie jest data ani czasem, wraca nietknieta.
  function formatDate(value, pattern) {
    var t = parseDateTime(value);
    var surowa = String(value == null ? "" : value);
    if (!t || !pattern) return surowa;
    var wzor = String(pattern);
    var out = "";
    var i = 0;
    var oczekujMinut = false;
    var uzytoDaty = false;
    while (i < wzor.length) {
      if (wzor[i] === "'") {
        var koniec = wzor.indexOf("'", i + 1);
        if (koniec < 0) {
          out += wzor.slice(i + 1);
          break;
        }
        out += koniec === i + 1 ? "'" : wzor.slice(i + 1, koniec);
        i = koniec + 1;
        continue;
      }
      var token = null;
      for (var k = 0; k < TOKENY.length; k += 1) {
        if (wzor.substr(i, TOKENY[k][0].length).toUpperCase() === TOKENY[k][0]) {
          token = TOKENY[k];
          break;
        }
      }
      if (!token) {
        out += wzor[i];
        i += 1;
        continue;
      }
      var pole = token[1];
      if (pole === "miesiac2" || pole === "miesiac") {
        if (oczekujMinut) {
          pole = "min";
          oczekujMinut = false;
        }
      } else if (pole === "godzina2" || pole === "godzina") {
        oczekujMinut = true;
      } else if (pole === "min") {
        oczekujMinut = false;
      }
      if (pole === "rok4" || pole === "rok2" || pole.indexOf("miesiac") === 0 || pole.indexOf("dzien") === 0) {
        uzytoDaty = true;
      }
      out += wartoscTokenu(pole, t);
      i += token[0].length;
    }
    // Sam czas we wzorcu z data (albo odwrotnie) dalby smieci - lepiej oddac
    // wartosc bez zmian, niz wpisac do formularza "00-00-0000".
    if (uzytoDaty && !t.maDate) return surowa;
    return out;
  }

  // Konwersje pod kontrolki HTML, ktore przyjmuja tylko jeden format.
  function toIsoDate(value) {
    var t = parseDateTime(value);
    if (!t || !t.maDate) return String(value == null ? "" : value);
    return String(t.y).padStart(4, "0") + "-" + dwie(t.m) + "-" + dwie(t.d);
  }

  function toIsoDateTime(value) {
    var t = parseDateTime(value);
    if (!t || !t.maDate) return String(value == null ? "" : value);
    return toIsoDate(value) + "T" + dwie(t.h) + ":" + dwie(t.mi);
  }

  function toTime(value) {
    var t = parseDateTime(value);
    if (!t || !t.maCzas) return String(value == null ? "" : value);
    return dwie(t.h) + ":" + dwie(t.mi);
  }

  // --------------------------------------------------- przeksztalcenia ----

  var OPERACJE = {
    upper: function (v) {
      return v.toUpperCase();
    },
    lower: function (v) {
      return v.toLowerCase();
    },
    trim: function (v) {
      return v.trim();
    },
    digits: function (v) {
      return v.replace(/[^0-9]/g, "");
    },
    // GTIN-14 z wiodacym zerem -> EAN-13, ktorego oczekuje wiekszosc systemow
    gtin13: function (v) {
      var cyfry = v.replace(/[^0-9]/g, "");
      return cyfry.length === 14 && cyfry[0] === "0" ? cyfry.slice(1) : cyfry;
    },
  };

  // Pole profilu moze byc selektorem ("input[name=x]") albo obiektem
  // {selector, format, transform} - to drugie pozwala dostroic wartosc.
  function selectorOf(entry) {
    if (typeof entry === "string") return entry;
    return (entry && entry.selector) || "";
  }

  function specOf(entry) {
    return typeof entry === "string" || !entry ? {} : entry;
  }

  function applyTransforms(value, spec) {
    var out = String(value == null ? "" : value);
    if (spec.format) out = formatDate(out, spec.format);
    var lista = spec.transform || [];
    for (var i = 0; i < lista.length; i += 1) {
      var op = String(lista[i]);
      if (Object.prototype.hasOwnProperty.call(OPERACJE, op)) {
        out = OPERACJE[op](out);
      } else if (op.indexOf("prefix:") === 0) {
        out = op.slice(7) + out;
      } else if (op.indexOf("suffix:") === 0) {
        out = out + op.slice(7);
      } else if (op.indexOf("slice:") === 0) {
        var zakres = op.slice(6).split(",");
        out = out.slice(Number(zakres[0]) || 0, zakres[1] === undefined ? undefined : Number(zakres[1]));
      }
    }
    return out;
  }

  // ------------------------------------------------------ wstawianie ----

  function fillSelect(el, value) {
    var wanted = normalizeText(value);
    var chosen = null;
    for (var i = 0; i < el.options.length; i += 1) {
      var opt = el.options[i];
      if (opt.value === value || normalizeText(opt.value) === wanted || normalizeText(opt.textContent) === wanted) {
        chosen = opt;
        break;
      }
    }
    if (!chosen) return { ok: false, error: "brak opcji '" + value + "' na liście" };
    el.value = chosen.value;
    fire(el, ["input", "change"]);
    return { ok: el.value === chosen.value };
  }

  function fillCheckable(el, value) {
    var want = TRUTHY.indexOf(normalizeText(value)) >= 0 || normalizeText(el.value) === normalizeText(value);
    if (el.type === "radio") want = normalizeText(el.value) === normalizeText(value);
    el.checked = want;
    fire(el, ["input", "change"]);
    return { ok: el.checked === want };
  }

  function fillEditable(el, value) {
    el.textContent = value;
    fire(el, ["input", "change"]);
    return { ok: el.textContent === value };
  }

  // Awaryjnie: zaznacz calosc i "wpisz" tekst - generuje pelne zdarzenia
  // wejscia, wiec radzi sobie z polami maskowanymi i uparta kontrolka.
  function insertViaCommand(el, value) {
    try {
      el.focus();
      if (el.setSelectionRange && typeof el.value === "string") el.setSelectionRange(0, el.value.length);
      else document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, value);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Wstawia jedna wartosc. Zwraca {ok, error}.
  function fillField(el, rawValue) {
    if (!el) return { ok: false, error: "nie znaleziono pola" };
    if (el.disabled || el.readOnly) return { ok: false, error: "pole zablokowane" };
    if (el.type === "password") return { ok: false, error: "pola hasła nie wypełniamy" };

    var value = String(rawValue == null ? "" : rawValue);
    if (el.tagName === "SELECT") return fillSelect(el, value);
    if (el.type === "checkbox" || el.type === "radio") return fillCheckable(el, value);
    if (el.isContentEditable) return fillEditable(el, value);
    // Kontrolki daty/czasu przyjmuja wylacznie swoj format - wlasny wzorzec
    // z profilu dotyczy pol tekstowych i tutaj musi ustapic.
    if (el.type === "date") value = toIsoDate(value);
    else if (el.type === "datetime-local") value = toIsoDateTime(value);
    else if (el.type === "time") value = toTime(value);
    if (el.type === "number") value = value.replace(/\s/g, "").replace(",", ".");

    try {
      el.focus();
    } catch (e) {
      /* pole moze byc poza ekranem - nie przerywamy */
    }
    setNativeValue(el, value);
    fire(el, ["input", "change"]);

    if (el.value !== value) {
      insertViaCommand(el, value);
      fire(el, ["change"]);
    }
    fire(el, ["blur"]);
    if (el.value !== value) return { ok: false, error: "pole odrzuciło wartość (jest '" + el.value + "')" };
    return { ok: true };
  }

  // Wypelnia caly formularz wg mapy {pole: selektor | {selector, format, transform}}.
  function fillForm(root, fields, values) {
    var filled = [];
    var failed = [];
    Object.keys(fields).forEach(function (name) {
      if (!(name in values)) return; // kod nie niesie tego pola - zostawiamy
      var entry = fields[name];
      var el = null;
      try {
        el = root.querySelector(selectorOf(entry));
      } catch (e) {
        failed.push({ name: name, error: "błędny selektor" });
        return;
      }
      var result = fillField(el, applyTransforms(values[name], specOf(entry)));
      if (result.ok) filled.push({ name: name, el: el });
      else failed.push({ name: name, error: result.error, el: el });
    });
    return { filled: filled, failed: failed };
  }

  globalThis.BRFill = {
    fillField: fillField,
    fillForm: fillForm,
    setNativeValue: setNativeValue,
    insertViaCommand: insertViaCommand,
    applyTransforms: applyTransforms,
    formatDate: formatDate,
    parseDateTime: parseDateTime,
    toIsoDateTime: toIsoDateTime,
    toTime: toTime,
    looksLikeDate: looksLikeDate,
    selectorOf: selectorOf,
    specOf: specOf,
    toIsoDate: toIsoDate,
    normalizeText: normalizeText,
  };
})();
