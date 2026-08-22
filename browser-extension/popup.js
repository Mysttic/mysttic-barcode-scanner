// Popup: globalny wlacznik + skrot do ustawien.
(function () {
  "use strict";
  const box = document.getElementById("enabled");
  chrome.storage.local.get("bcConfig", (r) => {
    const cfg = (r && r.bcConfig) || BC_DEFAULTS;
    box.checked = cfg.enabled !== false;
    document.getElementById("prefix").textContent = cfg.prefix;
    box.addEventListener("change", () => {
      const next = Object.assign({}, cfg, { enabled: box.checked });
      chrome.storage.local.set({ bcConfig: next });
    });
  });
  document.getElementById("options").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
})();
