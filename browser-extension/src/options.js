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
  if (spec.separator === "\t") {
    return MBS_I18N.t("options.frameTab", { count: (spec.fields || []).length });
  }
  if (spec.type === "delimited") {
    return MBS_I18N.t("options.frameDelimited", {
      prefix: spec.prefix ? "'" + spec.prefix + "'" : MBS_I18N.t("options.frameNoPrefix"),
      separator: spec.separator || ";",
    });
  }
  return spec.type || "?";
}

function renderList() {
  listaEl.innerHTML = state.profiles.length
    ? ""
    : "<p class='hint'>" + escapeHtml(MBS_I18N.t("options.empty")) + "</p>";
  state.profiles.forEach(function (profile, index) {
    var div = document.createElement("div");
    div.className = "profil" + (profile.enabled === false ? " off" : "");
    var fields = Object.keys(profile.fields || {}).join(", ");
    div.innerHTML =
      "<div class='prow'>" +
      "<label class='chk'><input type='checkbox' data-on='" + index + "'" +
      (profile.enabled !== false ? " checked" : "") + "> " + escapeHtml(MBS_I18N.t("options.enabled")) + "</label>" +
      "<input type='text' data-name='" + index + "' value='" + escapeHtml(profile.name) +
      "' placeholder='" + escapeHtml(MBS_I18N.t("options.namePlaceholder")) + "'>" +
      "<button class='ghost' data-up='" + index + "' title='" + escapeHtml(MBS_I18N.t("options.up")) + "'>▲</button>" +
      "<button class='ghost' data-down='" + index + "' title='" + escapeHtml(MBS_I18N.t("options.down")) + "'>▼</button>" +
      "<button class='ghost' data-dup='" + index + "'>" + escapeHtml(MBS_I18N.t("options.duplicate")) + "</button>" +
      "<button class='danger' data-del='" + index + "'>" + escapeHtml(MBS_I18N.t("options.delete")) + "</button>" +
      "</div>" +
      "<div class='prow'><span class='lbl'>" + escapeHtml(MBS_I18N.t("options.address")) + "</span>" +
      "<input type='text' data-url='" + index + "' value='" +
      escapeHtml((profile.match && profile.match.urlPattern) || "") +
      "' placeholder='" + escapeHtml(MBS_I18N.t("options.urlPlaceholder")) + "'></div>" +
      "<div class='pola'>" + escapeHtml(MBS_I18N.t("options.fieldsLabel")) + " " +
      escapeHtml(fields || "—") + " · " + escapeHtml(MBS_I18N.t("options.frameLabel")) + " " +
      escapeHtml(frameDesc(profile)) + "</div>";
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
      state.profiles[Number(input.getAttribute("data-name"))].name =
        input.value.trim() || MBS_I18N.t("options.defaultFormName");
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
      kopia.name = (kopia.name || MBS_I18N.t("options.defaultFormName")) + MBS_I18N.t("options.copySuffix");
      state.profiles.splice(i + 1, 0, kopia);
      persist();
    });
  });
  listaEl.querySelectorAll("button[data-del]").forEach(function (button) {
    button.addEventListener("click", function () {
      var i = Number(button.getAttribute("data-del"));
      if (!confirm(MBS_I18N.t("options.deleteConfirm", { name: state.profiles[i].name || "" }))) return;
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
    log(MBS_I18N.t("options.saved"), true);
  });
}

document.getElementById("zapisz").addEventListener("click", function () {
  var parsed;
  try {
    parsed = JSON.parse(jsonEl.value);
  } catch (e) {
    return log(MBS_I18N.t("options.badJson") + e.message, false);
  }
  if (!Array.isArray(parsed.profiles)) return log(MBS_I18N.t("options.noProfilesArray"), false);
  state = parsed;
  persist();
});

document.getElementById("eksport").addEventListener("click", function () {
  var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  var link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = MBS_I18N.t("options.exportFilename");
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
    log(MBS_I18N.t("options.fileLoaded"), true);
  });
});

document.getElementById("reset").addEventListener("click", function () {
  state = BRStore.defaults();
  persist();
});

var langEl = document.getElementById("lang");
langEl.addEventListener("change", function () {
  MBS_I18N.setLang(langEl.value, function () {
    MBS_I18N.applyDom();
    renderList();
  });
});

MBS_I18N.load(function (lang) {
  langEl.value = lang;
  MBS_I18N.applyDom();
  BRStore.load().then(function (loaded) {
    state = loaded;
    refresh();
  });
});
