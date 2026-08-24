// Service worker: badge ze stanem wtyczki + rozglaszanie zmian konfiguracji.
// Cala logika siedzi w content scripcie - tutaj tylko kosmetyka i synchronizacja.
"use strict";

function setBadge(tabId, active) {
  if (tabId == null) return;
  chrome.action.setBadgeText({ tabId: tabId, text: active ? "ON" : "" });
  chrome.action.setBadgeBackgroundColor({ tabId: tabId, color: "#16a34a" });
  chrome.action.setTitle({
    tabId: tabId,
    title: active ? "Aktywny profil: " + active : "Brak profilu dla tej strony - czytnik dziala jak zwykla klawiatura",
  });
}

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  var tabId = sender.tab && sender.tab.id;
  if (message.cmd === "activeProfile") {
    setBadge(tabId, message.name);
  } else if (message.cmd === "scan") {
    chrome.action.setBadgeText({ tabId: tabId, text: String(message.filled) });
    setTimeout(function () {
      setBadge(tabId, message.profile);
    }, 2000);
  }
  sendResponse({ ok: true });
  return false;
});

// Zmiana profili w opcjach ma dzialac bez przeladowania kart.
chrome.storage.onChanged.addListener(function (changes, area) {
  if (area !== "local" || !changes.state) return;
  chrome.tabs.query({}, function (tabs) {
    tabs.forEach(function (tab) {
      chrome.tabs.sendMessage(tab.id, { cmd: "reload" }, function () {
        void chrome.runtime.lastError; // karty bez content scriptu - normalne
      });
    });
  });
});
