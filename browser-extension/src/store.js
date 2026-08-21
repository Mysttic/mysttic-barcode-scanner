// Magazyn profili formularzy + dopasowanie profilu do strony.
//
// Profil formularza jest celowo blizniaczy do profilu w urzadzeniu:
//   match (gdzie) -> parse (jak rozlozyc kod na pola) -> fields (gdzie wstawic)
//
// Stan trzymany w chrome.storage.local pod kluczem "state":
//   { version, enabled, settings: {...}, profiles: [...] }
(function () {
  "use strict";

  var KEY = "state";

  var DEFAULT_SETTINGS = {
    // maksymalna przerwa miedzy znakami, przy ktorej ciag uznajemy za skan
    // (czlowiek nie pisze szybciej niz ~60 ms/znak w sposob ciagly)
    burstGapMs: 60,
    // krotsze ramki ignorujemy - to nie skan
    minFrameLength: 3,
    // podswietlanie wypelnionych pol
    highlight: true,
  };

  // Profil demonstracyjny dla test-vectors/forma-c-wtyczka.html.
  // Czytnik moze byc w konfiguracji fabrycznej (passthrough + ENTER) - kod
  // "PRC;JAN;KOWALSKI;12345;IT" leci 1:1, wtyczka sama go rozklada.
  var DEMO_PROFILE = {
    id: "demo-pracownik",
    name: "Karta pracownika (demo)",
    enabled: true,
    match: {
      urlPattern: "*forma-c-wtyczka.html*",
      requiredFields: ["imie", "nazwisko"],
    },
    parse: {
      type: "delimited",
      prefix: "PRC;",
      separator: ";",
      fields: ["_", "imie", "nazwisko", "numer", "dzial"],
    },
    fields: {
      imie: "input[name=imie]",
      nazwisko: "input[name=nazwisko]",
      numer: "input[name=numer]",
      dzial: "select[name=dzial]",
    },
    after: { action: "none" },
  };

  function defaults() {
    return { version: 1, enabled: true, settings: Object.assign({}, DEFAULT_SETTINGS), profiles: [DEMO_PROFILE] };
  }

  function normalize(state) {
    var base = defaults();
    if (!state || typeof state !== "object") return base;
    return {
      version: 1,
      enabled: state.enabled !== false,
      settings: Object.assign({}, DEFAULT_SETTINGS, state.settings || {}),
      profiles: Array.isArray(state.profiles) ? state.profiles : base.profiles,
    };
  }

  function load() {
    return new Promise(function (resolve) {
      try {
        chrome.storage.local.get(KEY, function (got) {
          resolve(normalize(got && got[KEY]));
        });
      } catch (e) {
        resolve(defaults());
      }
    });
  }

  function save(state) {
    var payload = {};
    payload[KEY] = normalize(state);
    return new Promise(function (resolve) {
      chrome.storage.local.set(payload, function () {
        resolve(payload[KEY]);
      });
    });
  }

  // Wzorzec URL z gwiazdkami: "*forma-c*" albo "https://erp.firma.pl/magazyn/*".
  // Wzorzec bez gwiazdki na koncu dopasowuje sie do calego adresu.
  function urlMatches(pattern, url) {
    if (!pattern) return false;
    var escaped = String(pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    var re;
    try {
      re = new RegExp("^" + escaped.replace(/\*/g, ".*") + "$");
    } catch (e) {
      return false;
    }
    return re.test(url);
  }

  // Kandydaci wg samego adresu - obecnosc pol sprawdza content script,
  // bo tylko on ma dostep do DOM (i tylko to odroznia formularze w SPA).
  function candidatesForUrl(state, url) {
    return (state.profiles || []).filter(function (p) {
      return p && p.enabled !== false && urlMatches(p.match && p.match.urlPattern, url);
    });
  }

  globalThis.BRStore = {
    KEY: KEY,
    defaults: defaults,
    normalize: normalize,
    load: load,
    save: save,
    urlMatches: urlMatches,
    candidatesForUrl: candidatesForUrl,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
  };
})();
