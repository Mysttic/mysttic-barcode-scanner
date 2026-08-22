// Opcje: lista profili + edycja/import/eksport calej konfiguracji jako JSON.
"use strict";

var jsonEl = document.getElementById("json");
var logEl = document.getElementById("log");
var listaEl = document.querySelector("#lista tbody");
var state = null;

function log(text, ok) {
  logEl.textContent = text;
  logEl.className = "log " + (ok ? "ok" : "err");
}

function renderList() {
  listaEl.innerHTML =
    "<tr><th>Profil</th><th>Adres</th><th>Pola</th><th></th></tr>" +
    (state.profiles.length ? "" : "<tr><td colspan='4'>brak profili</td></tr>");
  state.profiles.forEach(function (profile, index) {
    var row = document.createElement("tr");
    var fields = Object.keys(profile.fields || {}).join(", ");
    row.innerHTML =
      "<td><label><input type='checkbox' data-idx='" +
      index +
      "'" +
      (profile.enabled !== false ? " checked" : "") +
      "> " +
      escapeHtml(profile.name) +
      "</label></td><td><code>" +
      escapeHtml((profile.match && profile.match.urlPattern) || "") +
      "</code></td><td>" +
      escapeHtml(fields) +
      "</td><td><button class='ghost' data-del='" +
      index +
      "'>Usuń</button></td>";
    listaEl.appendChild(row);
  });

  listaEl.querySelectorAll("input[data-idx]").forEach(function (box) {
    box.addEventListener("change", function () {
      state.profiles[Number(box.getAttribute("data-idx"))].enabled = box.checked;
      persist();
    });
  });
  listaEl.querySelectorAll("button[data-del]").forEach(function (button) {
    button.addEventListener("click", function () {
      state.profiles.splice(Number(button.getAttribute("data-del")), 1);
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
