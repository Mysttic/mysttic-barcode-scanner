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

  // ------------------------------------------------------------- daty ----

  function poprawna(y, m, d) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    return { y: y, m: m, d: d };
  }

  // Rozpoznaje wszystko, co moze przyjsc z kodu albo z profilu urzadzenia:
  // RRRR-MM-DD, DD.MM.RRRR (takze / i -), RRRRMMDD oraz RRMMDD z GS1.
  // Osmiocyfrowe traktujemy jako RRRRMMDD - tak zapisuja daty kody kreskowe.
  function parseDate(value) {
    var v = String(value == null ? "" : value).trim();
    var m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v))) return poprawna(+m[1], +m[2], +m[3]);
    if ((m = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(v))) return poprawna(+m[3], +m[2], +m[1]);
    if ((m = /^(\d{4})(\d{2})(\d{2})$/.exec(v))) return poprawna(+m[1], +m[2], +m[3]);
    if (/^\d{6}$/.test(v)) {
      // RRMMDD z GS1 - w tym takze dzien "00" (= ostatni dzien miesiaca).
      // Regula siedzi w parserze, zeby nie miec jej w dwoch miejscach.
      var iso = globalThis.BRParse && globalThis.BRParse.dateToIso(v);
      if (iso) return parseDate(iso);
    }
    return null;
  }

  function looksLikeDate(value) {
    return parseDate(value) !== null;
  }

  // Wzorzec wyjsciowy: RRRR/YYYY, RR/YY, MM, DD (np. "DD.MM.RRRR").
  // Wartosc, ktora nie jest data, wraca nietknieta.
  function formatDate(value, pattern) {
    var d = parseDate(value);
    if (!d || !pattern) return String(value == null ? "" : value);
    var rok = String(d.y).padStart(4, "0");
    return String(pattern)
      .replace(/RRRR|YYYY/g, rok)
      .replace(/RR|YY/g, rok.slice(2))
      .replace(/MM/g, String(d.m).padStart(2, "0"))
      .replace(/DD/g, String(d.d).padStart(2, "0"));
  }

  // "31.12.2027" -> "2027-12-31" (input[type=date] przyjmuje wylacznie ISO).
  function toIsoDate(value) {
    var d = parseDate(value);
    if (!d) return String(value == null ? "" : value);
    return (
      String(d.y).padStart(4, "0") + "-" + String(d.m).padStart(2, "0") + "-" + String(d.d).padStart(2, "0")
    );
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
    // Kontrolka daty przyjmuje wylacznie ISO - wlasny format profilu
    // dotyczy pol tekstowych i tutaj musi ustapic.
    if (el.type === "date") value = toIsoDate(value);
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
    parseDate: parseDate,
    looksLikeDate: looksLikeDate,
    selectorOf: selectorOf,
    specOf: specOf,
    toIsoDate: toIsoDate,
    normalizeText: normalizeText,
  };
})();
