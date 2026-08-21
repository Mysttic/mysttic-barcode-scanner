// Wstawianie wartosci do pol formularza.
//
// PULAPKA, dla ktorej ten plik istnieje: samo `el.value = "X"` nie dziala na
// stronach w React/Vue/Angular. Framework trzyma wlasna kopie stanu i nie
// zauwaza podmiany, wiec formularz zapisze sie PUSTY mimo widocznej wartosci.
// Dlatego: natywny setter z prototypu + zdarzenia input/change, a gdy odczyt
// zwrotny sie nie zgadza - awaryjnie execCommand("insertText"), ktore generuje
// prawdziwe zdarzenia wejscia.
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

  // "31.12.2027" / "31-12-2027" -> "2027-12-31" (input[type=date] chce ISO).
  function toIsoDate(value) {
    if (/^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]$/.test(value)) return value;
    var m = /^([0-9]{1,2})[.\-/]([0-9]{1,2})[.\-/]([0-9]{4})$/.exec(value);
    if (!m) return value;
    return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
  }

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
    if (!chosen) return { ok: false, error: "brak opcji '" + value + "' na liscie" };
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
    if (el.type === "password") return { ok: false, error: "pola hasla nie wypelniamy" };

    var value = String(rawValue == null ? "" : rawValue);
    if (el.tagName === "SELECT") return fillSelect(el, value);
    if (el.type === "checkbox" || el.type === "radio") return fillCheckable(el, value);
    if (el.isContentEditable) return fillEditable(el, value);
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
    if (el.value !== value) return { ok: false, error: "pole odrzucilo wartosc (jest '" + el.value + "')" };
    return { ok: true };
  }

  // Wypelnia caly formularz wg mapy {pole: selektor}. Zwraca podsumowanie.
  function fillForm(root, selectors, values) {
    var filled = [];
    var failed = [];
    Object.keys(selectors).forEach(function (name) {
      if (!(name in values)) return; // kod nie niesie tego pola - zostawiamy
      var el = null;
      try {
        el = root.querySelector(selectors[name]);
      } catch (e) {
        failed.push({ name: name, error: "bledny selektor" });
        return;
      }
      var result = fillField(el, values[name]);
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
    toIsoDate: toIsoDate,
    normalizeText: normalizeText,
  };
})();
