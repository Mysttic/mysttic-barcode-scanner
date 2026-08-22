// Edytor profili wtyczki. Model danych = BC_DEFAULTS (profiles.js);
// zapis do chrome.storage.local pod kluczem bcConfig.
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const list = $("profiles");

  function mapToText(map) {
    return Object.keys(map).map((sel) => sel + " => " + map[sel]).join("\n");
  }

  function textToMap(text) {
    const map = {};
    for (const raw of text.split("\n")) {
      const line = raw.trim();
      if (!line) continue;
      const i = line.indexOf("=>");
      if (i < 1) throw new Error("brak separatora \"=>\" w linii: " + line);
      const sel = line.slice(0, i).trim();
      const tpl = line.slice(i + 2).trim();
      if (!sel || !tpl) throw new Error("pusta czesc mapowania w linii: " + line);
      map[sel] = tpl;
    }
    if (!Object.keys(map).length) throw new Error("profil bez mapowan");
    return map;
  }

  function profileCard(p) {
    const div = document.createElement("div");
    div.className = "profile" + (p.enabled === false ? " off" : "");
    div.innerHTML =
      '<div class="row">' +
      '<label class="switch"><input type="checkbox" class="p-on"> włączony</label>' +
      '<label style="flex:1">nazwa<input type="text" class="p-name"></label>' +
      '<button class="p-del">Usuń</button></div>' +
      '<div class="grid2">' +
      '<label>host (bez www)<input type="text" class="p-host" placeholder="example.com"></label>' +
      '<label>ścieżka (opcjonalnie, dokładna)<input type="text" class="p-path" placeholder="/auth/register"></label>' +
      "</div>" +
      '<label>mapowania (selektor =&gt; szablon)<textarea class="p-map" spellcheck="false"></textarea></label>';
    div.querySelector(".p-on").checked = p.enabled !== false;
    div.querySelector(".p-name").value = p.name || "";
    div.querySelector(".p-host").value = p.host || "";
    div.querySelector(".p-path").value = p.path || "";
    div.querySelector(".p-map").value = mapToText(p.map || {});
    div.querySelector(".p-on").addEventListener("change", (e) => {
      div.classList.toggle("off", !e.target.checked);
    });
    div.querySelector(".p-del").addEventListener("click", () => div.remove());
    return div;
  }

  function render(cfg) {
    $("g-enabled").checked = cfg.enabled !== false;
    $("g-prefix").value = cfg.prefix;
    $("g-fields").value = cfg.fields.join(", ");
    list.textContent = "";
    cfg.profiles.forEach((p) => list.appendChild(profileCard(p)));
  }

  function collect() {
    const prefix = $("g-prefix").value.trim();
    if (!prefix) throw new Error("prefiks nie moze byc pusty");
    const fields = $("g-fields").value.split(",").map((s) => s.trim()).filter(Boolean);
    if (!fields.length) throw new Error("podaj co najmniej jedno pole ramki");
    const profiles = [...list.querySelectorAll(".profile")].map((div) => {
      const host = div.querySelector(".p-host").value.trim().replace(/^www\./, "");
      if (!host) throw new Error("profil bez hosta");
      const p = {
        name: div.querySelector(".p-name").value.trim() || host,
        host,
        enabled: div.querySelector(".p-on").checked,
        map: textToMap(div.querySelector(".p-map").value)
      };
      const path = div.querySelector(".p-path").value.trim();
      if (path) p.path = path;
      return p;
    });
    return { enabled: $("g-enabled").checked, prefix, fields, profiles };
  }

  function status(msg, ok) {
    const el = $("status");
    el.textContent = msg;
    el.className = ok ? "ok" : "err";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.textContent = ""; }, 4000);
  }

  function save(cfg) {
    chrome.storage.local.set({ bcConfig: cfg }, () => status("zapisano ✓", true));
  }

  $("btn-save").addEventListener("click", () => {
    try { save(collect()); } catch (e) { status(e.message, false); }
  });

  $("btn-add").addEventListener("click", () => {
    list.appendChild(profileCard({ name: "", host: "", enabled: true, map: { "#pole": "{imie}" } }));
  });

  $("btn-defaults").addEventListener("click", () => {
    render(JSON.parse(JSON.stringify(BC_DEFAULTS)));
    status("przywrocono domyslne (kliknij Zapisz, by utrwalic)", true);
  });

  $("btn-export").addEventListener("click", () => {
    try {
      const blob = new Blob([JSON.stringify(collect(), null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "czytnik-profile.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { status(e.message, false); }
  });

  $("btn-import").addEventListener("click", () => $("file-import").click());
  $("file-import").addEventListener("change", (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    f.text().then((t) => {
      const cfg = JSON.parse(t);
      if (!cfg.prefix || !Array.isArray(cfg.fields) || !Array.isArray(cfg.profiles)) {
        throw new Error("niepoprawny format pliku");
      }
      render(cfg);
      status("wczytano (kliknij Zapisz, by utrwalic)", true);
    }).catch((e) => status("import: " + e.message, false));
    ev.target.value = "";
  });

  chrome.storage.local.get("bcConfig", (r) => {
    render(r && r.bcConfig ? r.bcConfig : JSON.parse(JSON.stringify(BC_DEFAULTS)));
  });
})();
