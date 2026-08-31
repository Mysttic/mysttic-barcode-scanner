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

  // Profil demonstracyjny dla test-vectors/forms/form-c-extension.html.
  // RAMKA TAB-OWA (separator "\t"): czytnik zostaje w PRODUKCYJNEJ konfiguracji
  // z wlaczonym profilem pracownik-tab (imie TAB nazwisko TAB numer TAB dzial
  // ENTER) - na rozpoznanym formularzu wtyczka przechwytuje cala sekwencje
  // (TAB-y nie ruszaja fokusa) i rozklada pola po nazwach. Nikt niczego nie
  // przelacza. segmentPatterns odrozniaja te ramke od innych 4-segmentowych.
  var DEMO_PROFILE = {
    id: "demo-pracownik",
    name: "Karta pracownika (demo)",
    enabled: true,
    match: {
      urlPattern: "*form-c-extension.html*",
      requiredFields: ["imie", "nazwisko"],
    },
    parse: {
      type: "delimited",
      separator: "\t",
      fields: ["imie", "nazwisko", "numer", "dzial"],
      segmentPatterns: { numer: "^[0-9]+$" },
    },
    fields: {
      imie: "input[name=imie]",
      nazwisko: "input[name=nazwisko]",
      numer: "input[name=numer]",
      dzial: "select[name=dzial]",
    },
    after: { action: "none" },
  };

  // Drugi profil demonstracyjny: zamowienie leku (test-vectors/forms/form-c-medicine.html).
  // Rowniez ramka TAB-owa - z PRODUKCYJNEGO profilu gs1-datamatrix w czytniku
  // (gtin TAB dataISO TAB partia TAB serial ENTER). Wzorce segmentow pilnuja,
  // zeby ramka pracownika nie wpadla w formularz leku i odwrotnie.
  var DEMO_PROFILE_LEK = {
    id: "demo-lek",
    name: "Zamówienie leku (demo)",
    enabled: true,
    match: {
      urlPattern: "*form-c-medicine.html*",
      requiredFields: ["numerSeryjny", "dataWaznosci"],
    },
    parse: {
      type: "delimited",
      separator: "\t",
      fields: ["gtin", "dataWaznosci", "partia", "numerSeryjny"],
      segmentPatterns: {
        gtin: "^[0-9]{14}$",
        dataWaznosci: "^[0-9]{4}-[0-9]{2}-[0-9]{2}$",
      },
    },
    fields: {
      gtin: "input[name=gtin]",
      dataWaznosci: "input[name=dataWaznosci]",
      partia: "input[name=partia]",
      numerSeryjny: "input[name=numerSeryjny]",
    },
    after: { action: "none" },
  };

  function defaults() {
    return {
      version: 1,
      enabled: true,
      settings: Object.assign({}, DEFAULT_SETTINGS),
      profiles: [DEMO_PROFILE, DEMO_PROFILE_LEK],
    };
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

  // Wzorzec URL z gwiazdkami: "*form-c*" albo "https://erp.firma.pl/magazyn/*".
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
