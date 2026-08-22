// Content script: nasluch "keyboard wedge" + wypelnianie pol po selektorach.
// Czytnik wpisuje ramke PREFIX;pole1;pole2;... i konczy Enterem; skrypt polyka
// znaki ramki (nie trafiaja do pol), tnie ja i wstawia wartosci wg profilu strony.
(function () {
  "use strict";

  const hasStorage = typeof chrome !== "undefined" && chrome.storage && chrome.storage.local;
  let cfg = BC_DEFAULTS;
  let chip = null;
  let lastHref = "";
  let buf = "";
  let last = 0;

  function activeProfile() {
    return bcMatchProfile(cfg, location);
  }

  // Ustawienie wartosci tak, by frameworki (React/Angular/Vue) ja zauwazyly:
  // natywny setter + zdarzenia input/change. Dla <select> dopasowanie opcji
  // po value, a w drugiej kolejnosci po fragmencie tekstu.
  function setVal(el, v) {
    if (el.tagName === "SELECT") {
      let opt = [...el.options].find((o) => o.value === v);
      if (!opt) opt = [...el.options].find((o) => o.text.toLowerCase().includes(v.toLowerCase()));
      if (!opt) return false;
      el.value = opt.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const d = Object.getOwnPropertyDescriptor(proto, "value");
    if (d && d.set) d.set.call(el, v);
    else el.value = v;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function flash(el) {
    const o = el.style.outline;
    el.style.outline = "2px solid #22c55e";
    setTimeout(() => { el.style.outline = o; }, 1500);
  }

  function fill(frame, prof, retry) {
    const parts = frame.split(";");
    const vals = {};
    cfg.fields.forEach((f, i) => { vals[f] = parts[i + 1] || ""; });
    let n = 0, miss = 0;
    Object.keys(prof.map).forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) { miss++; return; }
      const v = prof.map[sel].replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m));
      if (setVal(el, v)) { flash(el); n++; }
    });
    // SPA moglo jeszcze nie wyrenderowac formularza - jedno ponowienie
    if (n === 0 && miss > 0 && !retry) {
      note("pola jeszcze sie renderuja - ponawiam...", "#78350f");
      setTimeout(() => fill(frame, prof, true), 600);
      return;
    }
    note("wypelniono pol: " + n + (miss ? " (nie znaleziono: " + miss + ")" : ""), "#14532d");
  }

  function ensureChip() {
    if (chip && chip.isConnected) return chip;
    chip = document.createElement("div");
    chip.style.cssText = "position:fixed;right:10px;bottom:10px;z-index:2147483647;" +
      "background:#1a2230;color:#e6ecf5;font:13px system-ui;padding:8px 14px;" +
      "border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.4)";
    document.body.appendChild(chip);
    return chip;
  }

  function updateChip() {
    const prof = activeProfile();
    if (!prof) { if (chip) { chip.remove(); chip = null; } return; }
    ensureChip().textContent = "\u{1F4F7} nasluch: " + prof.name;
    chip.style.background = "#1a2230";
  }

  function note(t, c) {
    const el = ensureChip();
    el.textContent = "\u{1F4F7} " + t;
    el.style.background = c;
    clearTimeout(el._t);
    el._t = setTimeout(updateChip, 3000);
  }

  function onKey(e) {
    const prof = activeProfile();          // liczone per klawisz: dziala tez po nawigacji SPA
    if (!prof) return;                     // strona bez profilu = wtyczka niewidoczna
    const now = Date.now();
    if (now - last > 400) buf = "";        // przerwa = nowy strumien (czlowiek pisze wolniej)
    last = now;
    if (e.key === "Enter") {
      if (buf.indexOf(cfg.prefix) === 0) {
        e.preventDefault();
        e.stopPropagation();
        const f = buf;
        buf = "";
        fill(f, prof, false);
      } else buf = "";
      return;
    }
    if (e.key.length === 1) {
      buf += e.key;
      // dopoki strumien wyglada na ramke czytnika, nie wpuszczaj znakow do pol
      if (cfg.prefix.indexOf(buf) === 0 || buf.indexOf(cfg.prefix) === 0) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
  }

  function init() {
    window.addEventListener("keydown", onKey, true);
    updateChip();
    lastHref = location.href;
    // SPA zmieniaja adres bez przeladowania - odswiezaj plakietke
    setInterval(() => {
      if (location.href !== lastHref) { lastHref = location.href; updateChip(); }
    }, 2000);
    if (hasStorage) {
      chrome.storage.onChanged.addListener((ch, area) => {
        if (area === "local" && ch.bcConfig) {
          cfg = ch.bcConfig.newValue || BC_DEFAULTS;
          updateChip();
        }
      });
    }
  }

  if (hasStorage) {
    chrome.storage.local.get("bcConfig", (r) => {
      if (r && r.bcConfig) cfg = r.bcConfig;
      init();
    });
  } else {
    init(); // tryb testowy poza wtyczka (wstrzykniecie na strone) - same domyslne
  }
})();
