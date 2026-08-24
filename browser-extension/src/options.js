// Opcje: lista profili + edycja/import/eksport calej konfiguracji jako JSON.
"use strict";

var jsonEl = document.getElementById("json");
var logEl = document.getElementById("log");
var listaEl = document.getElementById("lista");
var state = null;

function log(text, ok) {
  logEl.textContent = text;
  logEl.className = "log " + (ok ? "ok" : "err");
}

// Krotki opis ramki profilu do listy (bez zagladania w JSON).
function frameDesc(profile) {
  var spec = profile.parse || {};
  if (spec.separator === "\t") return "TAB-owa, " + (spec.fields || []).length + " segm.";
  if (spec.type === "delimited") return (spec.prefix ? "'" + spec.prefix + "'" : "bez prefiksu") + " po '" + (spec.separator || ";") + "'";
  return spec.type || "?";
}

function renderList() {
  listaEl.innerHTML = state.profiles.length ? "" : "<p class='hint'>brak profili — użyj trybu nauki (ikona wtyczki → Ucz formularza)</p>";
  state.profiles.forEach(function (profile, index) {
    var div = document.createElement("div");
    div.className = "profil" + (profile.enabled === false ? " off" : "");
    var fields = Object.keys(profile.fields || {}).join(", ");
    div.innerHTML =
      "<div class='prow'>" +
      "<label class='chk'><input type='checkbox' data-on='" + index + "'" +
      (profile.enabled !== false ? " checked" : "") + "> włączony</label>" +
      "<input type='text' data-name='" + index + "' value='" + escapeHtml(profile.name) + "' placeholder='nazwa profilu'>" +
      "<button class='ghost' data-up='" + index + "' title='wyżej (pierwszy pasujący wygrywa)'>▲</button>" +
      "<button class='ghost' data-down='" + index + "' title='niżej'>▼</button>" +
      "<button class='ghost' data-dup='" + index + "'>Duplikuj</button>" +
      "<button class='danger' data-del='" + index + "'>Usuń</button>" +
      "</div>" +
      "<div class='prow'><span class='lbl'>adres:</span>" +
      "<input type='text' data-url='" + index + "' value='" +
      escapeHtml((profile.match && profile.match.urlPattern) || "") +
      "' placeholder='np. https://erp.firma.pl/przyjecie*'></div>" +
      "<div class='pola'>pola: " + escapeHtml(fields || "—") + " · ramka: " + escapeHtml(frameDesc(profile)) + "</div>";
    listaEl.appendChild(div);
  });

  listaEl.querySelectorAll("input[data-on]").forEach(function (box) {
    box.addEventListener("change", function () {
      state.profiles[Number(box.getAttribute("data-on"))].enabled = box.checked;
      persist();
    });
  });
  listaEl.querySelectorAll("input[data-name]").forEach(function (input) {
    input.addEventListener("change", function () {
      state.profiles[Number(input.getAttribute("data-name"))].name = input.value.trim() || "Formularz";
      persist();
    });
  });
  listaEl.querySelectorAll("input[data-url]").forEach(function (input) {
    input.addEventListener("change", function () {
      var profile = state.profiles[Number(input.getAttribute("data-url"))];
      profile.match = profile.match || {};
      profile.match.urlPattern = input.value.trim();
      persist();
    });
  });
  listaEl.querySelectorAll("button[data-up]").forEach(function (button) {
    button.addEventListener("click", function () {
      var i = Number(button.getAttribute("data-up"));
      if (i === 0) return;
      var p = state.profiles.splice(i, 1)[0];
      state.profiles.splice(i - 1, 0, p);
      persist();
    });
  });
  listaEl.querySelectorAll("button[data-down]").forEach(function (button) {
    button.addEventListener("click", function () {
      var i = Number(button.getAttribute("data-down"));
      if (i >= state.profiles.length - 1) return;
      var p = state.profiles.splice(i, 1)[0];
      state.profiles.splice(i + 1, 0, p);
      persist();
    });
  });
  listaEl.querySelectorAll("button[data-dup]").forEach(function (button) {
    button.addEventListener("click", function () {
      var i = Number(button.getAttribute("data-dup"));
      var kopia = JSON.parse(JSON.stringify(state.profiles[i]));
      kopia.id = "profil-" + Math.random().toString(36).slice(2, 10);
      kopia.name = (kopia.name || "Formularz") + " (kopia)";
      state.profiles.splice(i + 1, 0, kopia);
      persist();
    });
  });
  listaEl.querySelectorAll("button[data-del]").forEach(function (button) {
    button.addEventListener("click", function () {
      var i = Number(button.getAttribute("data-del"));
      if (!confirm("Usunąć profil \"" + (state.profiles[i].name || "") + "\"?")) return;
      state.profiles.splice(i, 1);
      persist();
    });
  });
}

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function refresh() {
  jsonEl.value = JSON.stringify(state, null, 2);
  renderList();
}

function persist() {
  BRStore.save(state).then(function (saved) {
    state = saved;
    refresh();
    log("Zapisano.", true);
  });
}

document.getElementById("zapisz").addEventListener("click", function () {
  var parsed;
  try {
    parsed = JSON.parse(jsonEl.value);
  } catch (e) {
    return log("Błędny JSON: " + e.message, false);
  }
  if (!Array.isArray(parsed.profiles)) return log("Brak tablicy 'profiles'.", false);
  state = parsed;
  persist();
});

document.getElementById("eksport").addEventListener("click", function () {
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "profile-formularzy.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

document.getElementById("import").addEventListener("click", function () {
  document.getElementById("plik").click();
});

document.getElementById("plik").addEventListener("change", function (ev) {
  var file = ev.target.files[0];
  if (!file) return;
  file.text().then(function (text) {
    jsonEl.value = text;
    log("Wczytano plik — sprawdź i kliknij Zapisz.", true);
  });
});

document.getElementById("reset").addEventListener("click", function () {
  state = BRStore.defaults();
  persist();
});

BRStore.load().then(function (loaded) {
  state = loaded;
  refresh();
});
