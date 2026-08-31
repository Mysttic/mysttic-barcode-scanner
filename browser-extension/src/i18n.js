// Teksty wtyczki w dwoch jezykach. Domyslnie angielski; wybor uzytkownika
// siedzi w chrome.storage.local pod kluczem "lang", zeby popup, opcje i
// content script mialy ten sam jezyk.
"use strict";

var MBS_I18N = (function () {
  var EN = {
    "popup.checking": "checking…",
    "popup.noPage":
      "The extension does not work on this page (the Chrome Web Store or an internal page, for example).",
    "popup.recognised": "Recognised form:",
    "popup.recognisedHint": "Scan, and the data lands in the boxes.",
    "popup.noProfile": "No profile for this page.",
    "popup.noProfileBold": "The scanner works like an ordinary keyboard.",
    "popup.noProfileHint": "Use <i>Teach a form</i> to add a profile.",
    "popup.enabled": "Extension on",
    "popup.learn": "Teach a form",
    "popup.options": "Form profiles",

    "options.title": "Form profiles",
    "options.intro":
      "A profile ties three things together: <b>where</b> it works (address plus required " +
      "fields), <b>how</b> to split the code into fields (parse) and <b>where</b> to put the " +
      "values (selectors). The layout is deliberately the same as in the scanner's profiles.",
    "options.savedHeading": "Saved profiles",
    "options.newHint":
      "<b>A new profile:</b> open the form it should work on → the extension icon in the " +
      "toolbar → <b>Teach a form</b> → (1) scan the code, (2) name the segments, (3) click the " +
      "boxes it points at → Save. A tutorial with screenshots: " +
      "<code>BROWSER-EXTENSION.md</code> (on the MYSTTIC disk and in the repository, " +
      "directory <code>docs/</code>).",
    "options.orderHint":
      "You edit the name and the address in place, and the changes save themselves. Order " +
      "matters: when several profiles match a page, the <b>first</b> one on the list wins " +
      "(move them with the arrows). Fields and parsing change in the JSON below, or by " +
      "teaching the profile again.",
    "options.jsonHeading": "Configuration (JSON)",
    "options.save": "Save",
    "options.export": "Export to a file",
    "options.import": "Import from a file",
    "options.reset": "Restore the defaults",
    "options.empty": "no profiles, use the learning mode (extension icon → Teach a form)",
    "options.enabled": "enabled",
    "options.up": "up (the first match wins)",
    "options.down": "down",
    "options.delete": "Delete",
    "options.deleteConfirm": 'Delete the profile "{name}"?',
    "options.badJson": "Malformed JSON: ",
    "options.fileLoaded": "File loaded, check it and click Save.",
    "options.namePlaceholder": "profile name",
    "options.urlPlaceholder": "for example https://erp.company.com/receipt*",
    "options.duplicate": "Duplicate",
    "options.copySuffix": " (copy)",
    "options.saved": "Saved.",
    "options.noProfilesArray": "No 'profiles' array.",
    "options.address": "address:",
    "options.fieldsLabel": "fields:",
    "options.frameLabel": "frame:",
    "options.frameTab": "TAB-separated, {count} segments",
    "options.frameNoPrefix": "no prefix",
    "options.frameDelimited": "{prefix} split on '{separator}'",
    "options.defaultFormName": "Form",
    "options.exportFilename": "form-profiles.json",

    "parse.aiLength": "AI {ai}: expected {n} characters",
    "parse.aiTooLong": "AI {ai}: too long (>{n})",
    "parse.aiUnsupported": "unsupported AI '{ai}' at position {pos}",
    "parse.noFields": "the profile has no field list (parse.fields)",
    "parse.segments": "the code has {got} segments, the profile expects {want}",
    "parse.segmentsExact": "the code has {got} segments, the profile expects exactly {want}",
    "parse.badSegment": "malformed segment pattern {name}",
    "parse.badRegex": "malformed regular expression: ",
    "parse.prefix": "the frame does not start with '{prefix}'",

    "fill.noOption": "no option '{value}' on the list",
    "fill.password": "we do not fill password boxes",
    "fill.rejected": "the box rejected the value (it holds '{value}')",
    "fill.badSelector": "malformed selector",

    "pill.filled": "Filled in {count} ({profile})",
    "pill.failed": "Filled in {filled}/{total} - {name}: {error}",
    "pill.fields.one": "{count} field",
    "pill.fields.many": "{count} fields",

    "learn.step1.title": "Teach a form (1/3)",
    "learn.step1.body":
      "Scan the code you will be filling this form with. The characters will not reach the page.",
    "learn.cancel": "Cancel",
    "learn.step2.title": "Teach a form (2/3)",
    "learn.step2.body":
      "Name the segments of the code. Type <b>_</b> next to the ones that should be skipped " +
      "(a prefix, for example).",
    "learn.back": "← Back",
    "learn.backRescan": "← Back (scan again)",
    "learn.next": "Next →",
    "learn.step3.title": "Teach a form (3/3)",
    "learn.step3.body":
      "Click the box on the page that should receive <b>{field}</b> (value: <code>{value}</code>).",
    "learn.step3.chosen": "The box for <b>{field}</b> (value: <code>{value}</code>):",
    "learn.confirm": "Confirm and continue",
    "learn.repick": "Pick another box",
    "learn.skip": "Skip the box",
    "learn.save.title": "Save the profile",
    "learn.save.body":
      "The profile name and the address it should work on (an asterisk means any fragment).",
    "learn.save.button": "Save and enable",
    "learn.save.defaultName": "Form",
    "learn.save.prefixPlaceholder": "frame prefix",
    "learn.date.looksLike": "This looks like {kind}, insert it as:",
    "learn.date.withTime": "a date with a time",
    "learn.date.plain": "a date",
    "learn.date.customPlaceholder": "custom pattern, for example DD-MM-YY",
    "learn.date.use": "Use",

    "demo.medicine": "Medicine order (demo)",
    "lang.label": "Language",
  };

  var PL = {
    "popup.checking": "sprawdzanie…",
    "popup.noPage":
      "Wtyczka nie działa na tej stronie (np. sklep Chrome albo strona wewnętrzna).",
    "popup.recognised": "Rozpoznany formularz:",
    "popup.recognisedHint": "Skanuj, dane trafią do pól.",
    "popup.noProfile": "Brak profilu dla tej strony.",
    "popup.noProfileBold": "Czytnik działa jak zwykła klawiatura.",
    "popup.noProfileHint": "Użyj <i>Ucz formularza</i>, żeby dodać profil.",
    "popup.enabled": "Wtyczka włączona",
    "popup.learn": "Ucz formularza",
    "popup.options": "Profile formularzy",

    "options.title": "Profile formularzy",
    "options.intro":
      "Profil łączy trzy rzeczy: <b>gdzie</b> działa (adres i wymagane pola), <b>jak</b> " +
      "rozłożyć kod na pola (parse) i <b>gdzie</b> wstawić wartości (selektory). Układ jest " +
      "celowo taki sam jak w profilach czytnika.",
    "options.savedHeading": "Zapisane profile",
    "options.newHint":
      "<b>Nowy profil:</b> otwórz formularz, na którym ma działać → ikona wtyczki na pasku → " +
      "<b>Ucz formularza</b> → (1) zeskanuj kod, (2) nazwij segmenty, (3) klikaj wskazywane " +
      "pola → Zapisz. Samouczek ze zrzutami: <code>BROWSER-EXTENSION.md</code> (na dysku " +
      "MYSTTIC i w repozytorium, katalog <code>docs/</code>).",
    "options.orderHint":
      "Nazwę i adres edytujesz wprost, zmiany zapisują się same. Kolejność ma znaczenie: gdy " +
      "do strony pasuje kilka profili, wygrywa <b>pierwszy</b> z listy (przesuwaj strzałkami). " +
      "Pola i parsowanie zmienisz w JSON poniżej albo ucząc profil od nowa.",
    "options.jsonHeading": "Konfiguracja (JSON)",
    "options.save": "Zapisz",
    "options.export": "Eksportuj do pliku",
    "options.import": "Importuj z pliku",
    "options.reset": "Przywróć domyślne",
    "options.empty": "brak profili, użyj trybu nauki (ikona wtyczki → Ucz formularza)",
    "options.enabled": "włączony",
    "options.up": "wyżej (pierwszy pasujący wygrywa)",
    "options.down": "niżej",
    "options.delete": "Usuń",
    "options.deleteConfirm": 'Usunąć profil "{name}"?',
    "options.badJson": "Błędny JSON: ",
    "options.fileLoaded": "Wczytano plik, sprawdź i kliknij Zapisz.",
    "options.namePlaceholder": "nazwa profilu",
    "options.urlPlaceholder": "np. https://erp.firma.pl/przyjecie*",
    "options.duplicate": "Duplikuj",
    "options.copySuffix": " (kopia)",
    "options.saved": "Zapisano.",
    "options.noProfilesArray": "Brak tablicy 'profiles'.",
    "options.address": "adres:",
    "options.fieldsLabel": "pola:",
    "options.frameLabel": "ramka:",
    "options.frameTab": "TAB-owa, {count} segm.",
    "options.frameNoPrefix": "bez prefiksu",
    "options.frameDelimited": "{prefix} po '{separator}'",
    "options.defaultFormName": "Formularz",
    "options.exportFilename": "profile-formularzy.json",

    "parse.aiLength": "AI {ai}: oczekiwano {n} znaków",
    "parse.aiTooLong": "AI {ai}: za długie (>{n})",
    "parse.aiUnsupported": "nieobsługiwany AI '{ai}' na pozycji {pos}",
    "parse.noFields": "profil nie ma listy pól (parse.fields)",
    "parse.segments": "kod ma {got} segmentów, profil oczekuje {want}",
    "parse.segmentsExact": "kod ma {got} segmentów, profil oczekuje dokładnie {want}",
    "parse.badSegment": "błędny wzorzec segmentu {name}",
    "parse.badRegex": "błędny wyraz regularny: ",
    "parse.prefix": "ramka nie zaczyna się od '{prefix}'",

    "fill.noOption": "brak opcji '{value}' na liście",
    "fill.password": "pola hasła nie wypełniamy",
    "fill.rejected": "pole odrzuciło wartość (jest '{value}')",
    "fill.badSelector": "błędny selektor",

    "pill.filled": "Wypełniono {count} ({profile})",
    "pill.failed": "Wypełniono {filled}/{total} - {name}: {error}",
    "pill.fields.one": "{count} pole",
    "pill.fields.many": "{count} pól",

    "learn.step1.title": "Ucz formularza (1/3)",
    "learn.step1.body":
      "Zeskanuj kod, którym będziesz wypełniał ten formularz. Znaki nie trafią na stronę.",
    "learn.cancel": "Anuluj",
    "learn.step2.title": "Ucz formularza (2/3)",
    "learn.step2.body":
      "Nazwij segmenty kodu. Wpisz <b>_</b> przy tych, które mają zostać pominięte " +
      "(np. prefiks).",
    "learn.back": "← Wstecz",
    "learn.backRescan": "← Wstecz (skanuj ponownie)",
    "learn.next": "Dalej →",
    "learn.step3.title": "Ucz formularza (3/3)",
    "learn.step3.body":
      "Kliknij na stronie pole, do którego ma trafić <b>{field}</b> (wartość: <code>{value}</code>).",
    "learn.step3.chosen": "Pole dla <b>{field}</b> (wartość: <code>{value}</code>):",
    "learn.confirm": "Zatwierdź i dalej",
    "learn.repick": "Wybierz inne pole",
    "learn.skip": "Pomiń pole",
    "learn.save.title": "Zapisz profil",
    "learn.save.body": "Nazwa profilu i adres, na którym ma działać (gwiazdka = dowolny fragment).",
    "learn.save.button": "Zapisz i włącz",
    "learn.save.defaultName": "Formularz",
    "learn.save.prefixPlaceholder": "prefiks ramki",
    "learn.date.looksLike": "Wygląda na {kind}, wstawić jako:",
    "learn.date.withTime": "datę z czasem",
    "learn.date.plain": "datę",
    "learn.date.customPlaceholder": "własny wzorzec, np. DD-MM-RR",
    "learn.date.use": "Użyj",

    "demo.medicine": "Zamówienie leku (demo)",
    "lang.label": "Język",
  };

  var DICTS = { en: EN, pl: PL };
  var lang = "en";

  function t(key, vars) {
    var raw = (DICTS[lang] && DICTS[lang][key]) || EN[key] || key;
    if (!vars) return raw;
    return raw.replace(/\{(\w+)\}/g, function (m, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m;
    });
  }

  /** Wczytuje jezyk z magazynu i wola cb(). Bezpieczne poza kontekstem wtyczki. */
  function load(cb) {
    try {
      chrome.storage.local.get("lang", function (got) {
        if (got && (got.lang === "pl" || got.lang === "en")) lang = got.lang;
        if (cb) cb(lang);
      });
    } catch (e) {
      if (cb) cb(lang);
    }
  }

  function setLang(next, cb) {
    lang = next === "pl" ? "pl" : "en";
    try {
      chrome.storage.local.set({ lang: lang }, function () {
        if (cb) cb(lang);
      });
    } catch (e) {
      if (cb) cb(lang);
    }
  }

  function getLang() {
    return lang;
  }

  /** data-i18n -> textContent, data-i18n-html -> innerHTML, data-i18n-ph -> placeholder. */
  function applyDom(root) {
    var scope = root || document;
    scope.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    scope.querySelectorAll("[data-i18n-html]").forEach(function (el) {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    scope.querySelectorAll("[data-i18n-ph]").forEach(function (el) {
      el.placeholder = t(el.getAttribute("data-i18n-ph"));
    });
    scope.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      el.title = t(el.getAttribute("data-i18n-title"));
    });
    if (!root) document.documentElement.lang = lang;
  }

  return { t: t, load: load, setLang: setLang, getLang: getLang, applyDom: applyDom };
})();

// Jak pozostale moduly wtyczki: jawnie na globalThis, zeby dzialalo takze
// wtedy, gdy testy hostowe wykonuja plik przez new Function(source).
globalThis.MBS_I18N = MBS_I18N;
