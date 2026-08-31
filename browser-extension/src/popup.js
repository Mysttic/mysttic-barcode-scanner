// Popup: stan dla biezacej karty, wlacznik i wejscie w tryb nauki.
"use strict";

var statusEl = document.getElementById("status");
var enabledEl = document.getElementById("enabled");

function activeTab() {
  return new Promise(function (resolve) {
    // W prawdziwym popupie getCurrent() zwraca undefined (popup nie jest karta).
    // Gdy popup otwarto jako zwykla strone (debug, zrzuty do dokumentacji),
    // pokazywalby sam siebie - wtedy bierzemy aktywna karte zwyklego okna.
    chrome.tabs.getCurrent(function (wlasna) {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        var tab = tabs[0];
        if (!wlasna || !tab || tab.id !== wlasna.id) return resolve(tab);
        chrome.tabs.query({ active: true, windowType: "normal" }, function (normalne) {
          var inne = normalne.filter(function (kandydat) {
            return kandydat.id !== wlasna.id;
          });
          resolve(inne[inne.length - 1] || tab);
        });
      });
    });
  });
}

function ask(tabId, message) {
  return new Promise(function (resolve) {
    chrome.tabs.sendMessage(tabId, message, function (response) {
      void chrome.runtime.lastError;
      resolve(response || null);
    });
  });
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

function render(status) {
  if (!status) {
    statusEl.innerHTML = "<span class='off'>" + MBS_I18N.t("popup.noPage") + "</span>";
    return;
  }
  if (status.active) {
    statusEl.innerHTML =
      MBS_I18N.t("popup.recognised") +
      "<b>" + esc(status.active) + "</b>" +
      MBS_I18N.t("popup.recognisedHint");
  } else {
    statusEl.innerHTML =
      "<span class='off'>" + MBS_I18N.t("popup.noProfile") +
      "<b>" + MBS_I18N.t("popup.noProfileBold") + "</b>" +
      MBS_I18N.t("popup.noProfileHint") + "</span>";
  }
}

chrome.storage.local.get("state", function (got) {
  var state = (got && got.state) || {};
  enabledEl.checked = state.enabled !== false;
});

enabledEl.addEventListener("change", function () {
  chrome.storage.local.get("state", function (got) {
    var state = (got && got.state) || { version: 1, profiles: [] };
    state.enabled = enabledEl.checked;
    chrome.storage.local.set({ state: state });
  });
});

document.getElementById("learn").addEventListener("click", function () {
  activeTab().then(function (tab) {
    if (!tab) return;
    ask(tab.id, { cmd: "learn" }).then(function () {
      window.close();
    });
  });
});

document.getElementById("options").addEventListener("click", function () {
  chrome.runtime.openOptionsPage();
});

var langEl = document.getElementById("lang");
langEl.addEventListener("change", function () {
  MBS_I18N.setLang(langEl.value, function () {
    MBS_I18N.applyDom();
    refresh();
  });
});

function refresh() {
  activeTab().then(function (tab) {
    if (!tab) return render(null);
    ask(tab.id, { cmd: "status" }).then(render);
  });
}

MBS_I18N.load(function (lang) {
  langEl.value = lang;
  MBS_I18N.applyDom();
  refresh();
});
