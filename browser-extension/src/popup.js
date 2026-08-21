// Popup: stan dla biezacej karty, wlacznik i wejscie w tryb nauki.
"use strict";

var statusEl = document.getElementById("status");
var enabledEl = document.getElementById("enabled");

function activeTab() {
  return new Promise(function (resolve) {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      resolve(tabs[0]);
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

function render(status) {
  if (!status) {
    statusEl.innerHTML = "<span class='off'>Wtyczka nie dziala na tej stronie (np. sklep Chrome albo strona wewnetrzna).</span>";
    return;
  }
  if (status.active) {
    statusEl.innerHTML = "Rozpoznany formularz:<b>" + status.active + "</b>Skanuj - dane trafia do pol.";
  } else {
    statusEl.innerHTML =
      "<span class='off'>Brak profilu dla tej strony.<b>Czytnik dziala jak zwykla klawiatura.</b>" +
      "Uzyj <i>Ucz formularza</i>, zeby dodac profil.</span>";
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

activeTab().then(function (tab) {
  if (!tab) return render(null);
  ask(tab.id, { cmd: "status" }).then(render);
});
