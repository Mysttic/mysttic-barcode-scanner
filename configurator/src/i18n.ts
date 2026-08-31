// Teksty interfejsu w dwoch jezykach. Domyslnie angielski; wybor uzytkownika
// siedzi w localStorage, ale konfigurator bywa otwierany z dysku urzadzenia
// (file://), gdzie Chrome potrafi zablokowac storage - stad try/catch i
// zapasowa kopia w pamieci.
export type Lang = "en" | "pl";

const STORAGE_KEY = "mysttic.lang";

type Dict = Record<string, string>;

const EN: Dict = {
  "app.title": "Mysttic Barcode Scanner - configurator",
  "app.subtitle": "configurator",
  "conn.connect": "Connect",
  "conn.disconnect": "Disconnect",
  "conn.connected": "connected",
  "conn.disconnected": "disconnected",
  "conn.noWebSerial": "This browser has no WebSerial, use Chrome or Edge.",
  "conn.failed": "Could not connect: ",
  "conn.info": "firmware {fw} | protocol v{version} | mode: {mode}",
  "conn.olderThan": "(older than 0.9.0)",

  "tab.device": "Device",
  "tab.profiles": "Profiles",
  "tab.test": "Test",
  "tab.update": "Update",
  "tab.service": "Service",
  "btn.apply": "Apply",
  "btn.save": "Save permanently",

  "device.heading": "Device",
  "device.keyDelay": "Key delay (ms)",
  "device.suffixKey": "Closing key (with no profile)",
  "device.outMode": "Mode with no profile",
  "device.outMode.passthrough": "pass through 1:1",
  "device.outMode.split": "split (splitAt)",
  "device.splitAt": "Split after character no.",
  "device.actionDelay": "Pause after TAB/ENTER (ms)",
  "device.dupBlock": "Duplicate block (ms, 0 = off)",
  "device.prefixText": "Text prefix",
  "device.suffixText": "Text suffix",
  "device.none": "(none)",
  "device.onError": "When a profile cannot parse the code",
  "device.onError.raw": "send it raw, 1:1",
  "device.onError.skip": "skip the scan",

  "profiles.heading": "Profiles",
  "profiles.hint":
    'Action sequence: <code>{field}</code> types a parsed field, <code>"text"</code> types fixed text, ' +
    "and the words <code>TAB ENTER ESC BACKSPACE UP DOWN LEFT RIGHT F1-F12</code> press a key. " +
    "Example: <code>{firstName} TAB TAB ENTER {lastName}</code>",
  "profiles.add": "+ Add profile",
  "profile.enabled": "enabled",
  "profile.namePlaceholder": "profile name",
  "profile.delete": "Delete",
  "profile.parseType": "Parsing type",
  "profile.parseType.regexGroups": "regex with groups",
  "profile.parseType.gs1": "GS1 (AI 01/17/10/21)",
  "profile.detect": "Detection (regex)",
  "profile.parse": "Parsing (regex with groups)",
  "profile.fields": "Fields (name=group, comma separated)",
  "profile.sequence": "Action sequence",
  "profile.gs1hint": "GS1 fields: {gtin} {expiry} {expiryISO} {batch} {serial}",
  "profile.unnamed": "profile",
  "profile.new": "new-profile",

  "test.heading": "Test",
  "test.mode": "Test mode (scans land here, nothing is typed into windows)",
  "test.modeError": "Could not switch the mode: ",
  "test.fields": " | fields: ",
  "test.profile": " | profile: ",
  "test.noProfile": " | no profile",
  "test.nonAscii": "(non-ASCII) ",

  "update.heading": "Firmware update",
  "update.installed": "Installed version:",
  "update.releases": "check the latest release and the changelog",
  "update.step1": "Download the release package and verify its SHA-256 against <code>SHA256SUMS.txt</code>.",
  "update.step2": "Click <b>Restart into the bootloader</b> below; the scanner shows up as an <code>RPI-RP2</code> disk.",
  "update.step3":
    "If the release contains a new CircuitPython, drag the <code>.uf2</code> file onto <code>RPI-RP2</code> " +
    "and wait for the <code>CIRCUITPY</code> disk.",
  "update.step4":
    "Copy the contents of the package's <code>device/</code> directory onto <code>CIRCUITPY</code> " +
    "(overwrite the files), then unplug and replug USB.",
  "update.bootloader": "Restart into the bootloader (RPI-RP2)",

  "service.heading": "Service",
  "service.hint":
    "<b>Apply</b> (the bar at the top) lasts until the device restarts; " +
    "<b>Save permanently</b> writes the configuration into the scanner's memory.",
  "service.reload": "Reload from the device",
  "service.export": "Export JSON",
  "service.import": "Import JSON",
  "service.factory": "Factory settings",
  "service.reboot": "Restart",
  "service.bootloader": "Restart into the bootloader (UF2)",
  "service.factoryConfirm": "Restore the factory settings (this clears the NVM)?",
  "service.bootloaderConfirm":
    "The device will restart as an RPI-RP2 disk (firmware upload). Continue?",

  "footer.note": "Open in Chrome or Edge. The page talks to the scanner over WebSerial (USB).",

  "msg.applied": "✔ applied (until the device restarts)",
  "msg.saved": "✔ saved permanently and verified",
  "msg.savedMismatch": "⚠ saved, but the read-back differs from what was sent",
  "msg.imported": "✔ imported, now click Apply or Save permanently",
  "msg.importError": "import error: ",
  "msg.noBaseConfig": "no base configuration",
  "msg.deviceConfigInvalid": "the configuration from the device failed validation:",

  "val.emptyPattern": "the pattern cannot be empty",
  "val.braces": "{m,n} quantifiers do not work on the device, write them out",
  "val.badRegex": "malformed regular expression",
  "val.profileName": "the profile needs a name",
  "val.emptySequence": "the sequence cannot be empty",
  "val.unknownField": 'the field "{field}" does not exist (available: {known})',
  "val.needField": "give at least one field",
  "val.duplicateName": 'duplicate name "{name}"',
  "serial.noConnection": "no connection",

  "seq.emptyField": "empty {field}",
  "seq.unknownToken": 'unknown token: {token} (keys: {keys}, field: {name}, text: "...")',
  "seq.empty": "empty sequence",
  "seq.giveFields": "give the fields, for example firstName=1, lastName=2",
  "seq.badField": 'malformed field entry: "{part}" (format: name=groupNumber)',

  "lang.label": "Language",
};

const PL: Dict = {
  "app.title": "Mysttic Barcode Scanner - konfigurator",
  "app.subtitle": "konfigurator",
  "conn.connect": "Połącz",
  "conn.disconnect": "Rozłącz",
  "conn.connected": "połączony",
  "conn.disconnected": "rozłączony",
  "conn.noWebSerial": "Ta przeglądarka nie ma WebSerial, użyj Chrome albo Edge.",
  "conn.failed": "Nie udało się połączyć: ",
  "conn.info": "firmware {fw} | protokół v{version} | tryb: {mode}",
  "conn.olderThan": "(starsze niż 0.9.0)",

  "tab.device": "Urządzenie",
  "tab.profiles": "Profile",
  "tab.test": "Test",
  "tab.update": "Aktualizacja",
  "tab.service": "Serwis",
  "btn.apply": "Zastosuj",
  "btn.save": "Zapisz trwale",

  "device.heading": "Urządzenie",
  "device.keyDelay": "Opóźnienie klawiszy (ms)",
  "device.suffixKey": "Klawisz kończący (bez profilu)",
  "device.outMode": "Tryb bez profilu",
  "device.outMode.passthrough": "przepisz 1:1",
  "device.outMode.split": "podziel (splitAt)",
  "device.splitAt": "Podział po znaku nr",
  "device.actionDelay": "Pauza po TAB/ENTER (ms)",
  "device.dupBlock": "Blokada duplikatów (ms, 0 = wył.)",
  "device.prefixText": "Prefiks tekstowy",
  "device.suffixText": "Sufiks tekstowy",
  "device.none": "(brak)",
  "device.onError": "Gdy profil nie sparsuje kodu",
  "device.onError.raw": "wyślij surowy 1:1",
  "device.onError.skip": "pomiń skan",

  "profiles.heading": "Profile",
  "profiles.hint":
    'Sekwencja akcji: <code>{pole}</code> wpisuje sparsowane pole, <code>"tekst"</code> wpisuje stały tekst, ' +
    "a słowa <code>TAB ENTER ESC BACKSPACE UP DOWN LEFT RIGHT F1-F12</code> naciskają klawisz. " +
    "Przykład: <code>{firstName} TAB TAB ENTER {lastName}</code>",
  "profiles.add": "+ Dodaj profil",
  "profile.enabled": "włączony",
  "profile.namePlaceholder": "nazwa profilu",
  "profile.delete": "Usuń",
  "profile.parseType": "Typ parsowania",
  "profile.parseType.regexGroups": "regex z grupami",
  "profile.parseType.gs1": "GS1 (AI 01/17/10/21)",
  "profile.detect": "Wykrywanie (regex)",
  "profile.parse": "Parsowanie (regex z grupami)",
  "profile.fields": "Pola (nazwa=grupa, po przecinku)",
  "profile.sequence": "Sekwencja akcji",
  "profile.gs1hint": "Pola GS1: {gtin} {expiry} {expiryISO} {batch} {serial}",
  "profile.unnamed": "profil",
  "profile.new": "nowy-profil",

  "test.heading": "Test",
  "test.mode": "Tryb testowy (skany lecą tutaj, nic nie wpisuje się do okien)",
  "test.modeError": "Błąd przełączania trybu: ",
  "test.fields": " | pola: ",
  "test.profile": " | profil: ",
  "test.noProfile": " | bez profilu",
  "test.nonAscii": "(nie-ASCII) ",

  "update.heading": "Aktualizacja firmware",
  "update.installed": "Zainstalowana wersja:",
  "update.releases": "sprawdź najnowsze wydanie i changelog",
  "update.step1": "Pobierz paczkę wydania i zweryfikuj sumę SHA-256 z pliku <code>SHA256SUMS.txt</code>.",
  "update.step2":
    "Kliknij niżej <b>Restart do bootloadera</b>, czytnik pojawi się jako dysk <code>RPI-RP2</code>.",
  "update.step3":
    "Jeśli wydanie zawiera nowy CircuitPython, przeciągnij plik <code>.uf2</code> na <code>RPI-RP2</code> " +
    "i poczekaj na dysk <code>CIRCUITPY</code>.",
  "update.step4":
    "Skopiuj zawartość katalogu <code>device/</code> z paczki na dysk <code>CIRCUITPY</code> " +
    "(nadpisz pliki), po czym odłącz i podłącz USB.",
  "update.bootloader": "Restart do bootloadera (RPI-RP2)",

  "service.heading": "Serwis",
  "service.hint":
    "<b>Zastosuj</b> (pasek u góry) działa do restartu urządzenia; " +
    "<b>Zapisz trwale</b> utrwala konfigurację w pamięci czytnika.",
  "service.reload": "Odśwież z urządzenia",
  "service.export": "Eksport JSON",
  "service.import": "Import JSON",
  "service.factory": "Ustawienia fabryczne",
  "service.reboot": "Restart",
  "service.bootloader": "Restart do bootloadera (UF2)",
  "service.factoryConfirm": "Przywrócić ustawienia fabryczne (czyści NVM)?",
  "service.bootloaderConfirm":
    "Urządzenie zrestartuje się jako dysk RPI-RP2 (wgrywanie firmware). Kontynuować?",

  "footer.note": "Otwórz w Chrome albo Edge. Strona łączy się z czytnikiem przez WebSerial (USB).",

  "msg.applied": "✔ zastosowano (do restartu)",
  "msg.saved": "✔ zapisano trwale i zweryfikowano",
  "msg.savedMismatch": "⚠ zapisano, ale odczyt różni się od wysłanego",
  "msg.imported": "✔ zaimportowano, kliknij Zastosuj albo Zapisz trwale",
  "msg.importError": "błąd importu: ",
  "msg.noBaseConfig": "brak konfiguracji bazowej",
  "msg.deviceConfigInvalid": "konfiguracja z urządzenia nie przeszła walidacji:",

  "val.emptyPattern": "wzorzec nie może być pusty",
  "val.braces": "kwantyfikatory {m,n} nie działają na urządzeniu, rozpisz jawnie",
  "val.badRegex": "błędny wyraz regularny",
  "val.profileName": "profil musi mieć nazwę",
  "val.emptySequence": "sekwencja nie może być pusta",
  "val.unknownField": 'pole "{field}" nie istnieje (dostępne: {known})',
  "val.needField": "podaj co najmniej jedno pole",
  "val.duplicateName": 'zdublowana nazwa "{name}"',
  "serial.noConnection": "brak połączenia",

  "seq.emptyField": "puste {pole}",
  "seq.unknownToken": 'nieznany token: {token} (klawisze: {keys}, pole: {name}, tekst: "...")',
  "seq.empty": "pusta sekwencja",
  "seq.giveFields": "podaj pola, np. firstName=1, lastName=2",
  "seq.badField": 'błędny wpis pola: "{part}" (format: nazwa=numerGrupy)',

  "lang.label": "Język",
};

const DICTS: Record<Lang, Dict> = { en: EN, pl: PL };

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === "pl" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

let lang: Lang = readStored() ?? "en";

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // file:// bez storage - jezyk zostaje na czas tej sesji
  }
  applyI18n();
}

/** Tekst po kluczu; {placeholdery} podmieniane wartosciami z `vars`. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = DICTS[lang][key] ?? DICTS.en[key] ?? key;
  if (!vars) return raw;
  return raw.replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}

/**
 * Wstawia teksty w elementy oznaczone atrybutami:
 *   data-i18n       -> textContent
 *   data-i18n-html  -> innerHTML (dla tekstow z <code>/<b>)
 *   data-i18n-ph    -> placeholder
 *   data-i18n-title -> title
 */
export function applyI18n(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    el.textContent = t(el.dataset.i18n!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-html]").forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-ph]").forEach((el) => {
    (el as HTMLInputElement).placeholder = t(el.dataset.i18nPh!);
  });
  root.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle!);
  });
  if (root === document) {
    document.documentElement.lang = lang;
    document.title = t("app.title");
  }
}
