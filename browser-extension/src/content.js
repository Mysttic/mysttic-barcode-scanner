// Content script: rozpoznanie formularza -> przechwycenie skanu -> wypelnienie.
//
// ZASADA: dopoki zaden profil nie pasuje do strony, ten skrypt NIE dotyka
// klawiatury. Czytnik zachowuje sie wtedy dokladnie tak jak bez wtyczki
// (sekwencje TAB, passthrough) - brak regresji na stronach spoza profili.
(function () {
  "use strict";

  var state = null; // konfiguracja z magazynu
  var active = null; // profil dopasowany do tej strony (albo null)
  var lastUrl = location.href;
  var ui = null; // shadow-root z panelem/dymkiem

  var wedge = { buf: "", lastTs: 0, snapshot: null, blocked: false };
  var learn = null; // stan kreatora "Ucz formularza"

  // ---------------------------------------------------------------- UI ----

  function ensureUi() {
    if (ui && ui.host.isConnected) return ui;
    var host = document.createElement("div");
    host.style.cssText = "all:initial;position:fixed;z-index:2147483647;inset:auto auto 16px 16px;";
    var root = host.attachShadow({ mode: "open" });
    root.innerHTML =
      "<style>" +
      ":host,*{font-family:system-ui,sans-serif;box-sizing:border-box}" +
      ".pill{display:none;align-items:center;gap:8px;background:#0f172a;color:#fff;border-radius:999px;padding:8px 14px;font-size:13px;box-shadow:0 6px 20px rgba(0,0,0,.25)}" +
      ".dot{width:8px;height:8px;border-radius:50%;background:#22c55e}" +
      ".dot.warn{background:#f59e0b}" +
      ".panel{display:none;width:340px;background:#fff;color:#0f172a;border:1px solid #d8dee8;border-radius:12px;padding:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);font-size:13px;line-height:1.5}" +
      ".panel h2{margin:0 0 8px;font-size:14px}" +
      ".panel p{margin:0 0 10px;color:#475569}" +
      ".panel input,.panel select{width:100%;padding:6px 8px;border:1px solid #c5cdd9;border-radius:6px;font-size:13px;margin-bottom:6px}" +
      ".panel button{padding:7px 12px;border:0;border-radius:8px;background:#be123c;color:#fff;font-size:13px;cursor:pointer;margin-right:6px}" +
      ".panel button.ghost{background:#e2e8f0;color:#0f172a}" +
      ".rows{max-height:200px;overflow:auto;margin-bottom:10px}" +
      ".row{display:flex;gap:6px;align-items:center;margin-bottom:4px}" +
      ".wlasny{display:flex;gap:6px;margin-top:8px}" +
      ".wlasny input{margin:0}" +
      ".wlasny button{margin:0;white-space:nowrap}" +
      ".podglad{margin-top:6px;font-family:ui-monospace,monospace;font-size:12px;color:#0f172a;min-height:16px}" +
      ".row code{flex:0 0 110px;background:#eef1f6;padding:2px 6px;border-radius:4px;overflow:hidden;text-overflow:ellipsis}" +
      "</style>" +
      "<div class='pill'><span class='dot'></span><span class='txt'></span></div>" +
      "<div class='panel'></div>";
    (document.body || document.documentElement).appendChild(host);
    ui = {
      host: host,
      pill: root.querySelector(".pill"),
      pillText: root.querySelector(".txt"),
      pillDot: root.querySelector(".dot"),
      panel: root.querySelector(".panel"),
    };
    return ui;
  }

  var pillTimer = 0;
  function pill(text, warn, holdMs) {
    var u = ensureUi();
    u.pillText.textContent = text;
    u.pillDot.className = warn ? "dot warn" : "dot";
    u.pill.style.display = "flex";
    clearTimeout(pillTimer);
    if (holdMs !== 0) pillTimer = setTimeout(hidePill, holdMs || 4000);
  }

  function hidePill() {
    if (ui) ui.pill.style.display = "none";
  }

  function highlight(el, ok) {
    if (!el || !state.settings.highlight || !el.style) return;
    var previous = el.style.boxShadow;
    el.style.boxShadow = ok ? "0 0 0 2px #16a34a" : "0 0 0 2px #dc2626";
    setTimeout(function () {
      el.style.boxShadow = previous;
    }, 2500);
  }

  // Wiadomosc do tla; brak odbiorcy nie moze wywrocic skryptu (badge to kosmetyka).
  function notify(message) {
    try {
      chrome.runtime.sendMessage(message, function () {
        void chrome.runtime.lastError;
      });
    } catch (e) {
      /* kontekst rozszerzenia przeladowany - ignorujemy */
    }
  }

  // -------------------------------------------------------- aktywacja ----

  function resolve(selector) {
    try {
      return document.querySelector(selector);
    } catch (e) {
      return null;
    }
  }

  // Profil pasuje, gdy zgadza sie adres ORAZ wymagane pola sa na stronie.
  // Drugi warunek odroznia formularze w SPA pod tym samym adresem.
  function fieldsPresent(profile) {
    var required = (profile.match && profile.match.requiredFields) || Object.keys(profile.fields || {});
    if (!required.length) return false;
    return required.every(function (name) {
      var selector = BRFill.selectorOf((profile.fields || {})[name]);
      return selector ? !!resolve(selector) : false;
    });
  }

  function evaluate() {
    if (!state) return;
    var found = null;
    if (state.enabled) {
      var candidates = BRStore.candidatesForUrl(state, location.href);
      for (var i = 0; i < candidates.length; i += 1) {
        if (fieldsPresent(candidates[i])) {
          found = candidates[i];
          break;
        }
      }
    }
    var changed = (found && found.id) !== (active && active.id);
    active = found;
    notify({ cmd: "activeProfile", name: active ? active.name : null });
    if (changed) {
      resetWedge();
      if (active) pill("Czytnik: " + active.name);
      else hidePill();
    }
  }

  // SPA: adres zmienia sie bez przeladowania, a pola pojawiaja sie pozniej.
  // Patchowanie history.pushState nie zadziala (content script ma osobny
  // kontekst JS), wiec obserwujemy DOM i odpytujemy location.
  function watchPage() {
    var debounce = 0;
    new MutationObserver(function () {
      clearTimeout(debounce);
      debounce = setTimeout(evaluate, 300);
    }).observe(document.documentElement, { childList: true, subtree: true });

    setInterval(function () {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        evaluate();
      }
    }, 500);

    addEventListener("popstate", evaluate);
    addEventListener("hashchange", evaluate);
  }

  // ------------------------------------------------------------ wedge ----

  function resetWedge() {
    wedge.buf = "";
    wedge.snapshot = null;
    wedge.blocked = false;
    clearTimeout(wedge.flushTimer);
  }

  // Przerwany/niedokonczony przechwycony strumien: oddaj znaki stronie
  // i zacznij od nowa. Bez tego zablokowane znaki przepadalyby.
  function abortCapture() {
    if (wedge.blocked && wedge.buf) replayBuffer(wedge.snapshot, wedge.buf);
    resetWedge();
  }

  // Czy aktywny profil czyta ramke TAB-owa (sekwencje z profilu URZADZENIA)?
  // Wtedy wtyczka przechwytuje takze TAB-y - na rozpoznanym formularzu ona
  // rozklada pola, a urzadzenie moze zostac w produkcyjnej konfiguracji.
  function isTabFrame() {
    return !!(active && active.parse && active.parse.separator === "\t");
  }

  function captureFocus() {
    var el = document.activeElement;
    if (!el) return null;
    var isField = (el.tagName === "INPUT" || el.tagName === "TEXTAREA") && !el.disabled && !el.readOnly;
    if (!isField && !el.isContentEditable) return null;
    return {
      el: el,
      value: el.isContentEditable ? el.textContent : el.value,
      start: el.selectionStart == null ? 0 : el.selectionStart,
      end: el.selectionEnd == null ? 0 : el.selectionEnd,
    };
  }

  // Cofa to, co zdazylo wpasc do pola w trakcie skanu.
  function restoreSnapshot(snap) {
    if (!snap || !snap.el || !snap.el.isConnected) return;
    if (snap.el.isContentEditable) snap.el.textContent = snap.value;
    else BRFill.setNativeValue(snap.el, snap.value);
    snap.el.dispatchEvent(new Event("input", { bubbles: true }));
  }

  // Ramka nie byla nasza, a znaki zablokowalismy - oddaj je stronie.
  function replayBuffer(snap, text) {
    if (!snap || !snap.el || !snap.el.isConnected) return;
    var merged = snap.value.slice(0, snap.start) + text + snap.value.slice(snap.end);
    if (snap.el.isContentEditable) snap.el.textContent = merged;
    else BRFill.setNativeValue(snap.el, merged);
    snap.el.dispatchEvent(new Event("input", { bubbles: true }));
    snap.el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  // Blokujemy znaki tylko wtedy, gdy profil ma prefiks i ramka wciaz go
  // przypomina - dzieki temu strona nie widzi nawet przelotnie kodu.
  function shouldBlock(candidate) {
    var prefix = active && active.parse && active.parse.prefix;
    if (!prefix) return false;
    return prefix.indexOf(candidate) === 0 || candidate.indexOf(prefix) === 0;
  }

  function onKeyDown(ev) {
    if (learn) return onLearnKey(ev);
    if (!active || !state.enabled) return;
    if (ev.ctrlKey || ev.altKey || ev.metaKey || ev.isComposing) return;

    var now = performance.now();
    var tabFrame = isTabFrame();

    if (ev.key === "Enter") {
      var frame = wedge.buf;
      var blocked = wedge.blocked;
      var snapshot = wedge.snapshot;
      var minLength = state.settings.minFrameLength;
      resetWedge();
      if (!frame || frame.length < minLength) return;
      var parsed = BRParse.parseFrame(frame, active.parse);
      if (parsed.fields) {
        ev.preventDefault();
        ev.stopPropagation();
        restoreSnapshot(snapshot);
        applyScan(parsed.fields, frame);
      } else if (blocked) {
        // ramka nie byla nasza, a znaki przechwycilismy - oddaj je stronie
        replayBuffer(snapshot, frame);
        pill("Nierozpoznany kod: " + parsed.error, true);
      }
      return;
    }

    // Autorepeat = przytrzymany klawisz = czlowiek, nie skaner.
    if (ev.repeat) {
      abortCapture();
      return;
    }

    var isChar = ev.key.length === 1;
    var isTabInFrame = tabFrame && ev.key === "Tab" && wedge.buf !== "";

    if (!isChar && !isTabInFrame) {
      // Shift/CapsLock nie przerywaja ramki: czytnik pisze WIELKIE litery
      // i HID wysyla osobny keydown Shift przed kazda z nich.
      if (ev.key === "Shift" || ev.key === "CapsLock") return;
      // Profil prefiksowy: TAB w srodku ramki = sekwencja z urzadzenia
      // (wariant A) - nie mieszamy sie. Profil TAB-owy: samotny TAB czlowieka
      // (pusty bufor) tez przechodzi normalnie.
      abortCapture();
      return;
    }

    if (now - wedge.lastTs > state.settings.burstGapMs) {
      abortCapture();
      wedge.snapshot = captureFocus();
    }
    wedge.lastTs = now;
    var key = isTabInFrame ? "\t" : ev.key;
    var candidate = wedge.buf + key;

    if (tabFrame) {
      // Ramka bez prefiksu: pierwszy znak moze byc od czlowieka, wiec go
      // przepuszczamy (przy udanym parsowaniu cofnie go restoreSnapshot).
      // Od DRUGIEGO zdarzenia w szybkiej serii blokujemy - to skaner.
      if (wedge.buf !== "") {
        wedge.blocked = true;
        ev.preventDefault();
        ev.stopPropagation();
      }
    } else if (shouldBlock(candidate)) {
      wedge.blocked = true;
      ev.preventDefault();
      ev.stopPropagation();
    }
    wedge.buf = candidate;

    // Skan bez Entera na koncu (np. inna konfiguracja sufiksu) nie moze
    // "zjesc" znakow na zawsze - po ciszy oddajemy je stronie.
    clearTimeout(wedge.flushTimer);
    if (wedge.blocked) wedge.flushTimer = setTimeout(abortCapture, 350);
  }

  // 1 pole / 2-4 pola / 5+ pol - inaczej dymek brzmi jak tlumaczenie z angielskiego.
  // Po angielsku wystarczy liczba pojedyncza i mnoga.
  function odmianaPol(ile) {
    if (MBS_I18N.getLang() !== "pl") {
      return MBS_I18N.t(ile === 1 ? "pill.fields.one" : "pill.fields.many", { count: ile });
    }
    if (ile === 1) return "1 pole";
    var jednosci = ile % 10;
    var dziesiatki = ile % 100;
    if (jednosci >= 2 && jednosci <= 4 && (dziesiatki < 12 || dziesiatki > 14)) return ile + " pola";
    return ile + " pól";
  }

  function applyScan(fields, frame) {
    var result = BRFill.fillForm(document, active.fields || {}, fields);
    result.filled.forEach(function (item) {
      highlight(item.el, true);
    });
    result.failed.forEach(function (item) {
      highlight(item.el, false);
    });

    var total = result.filled.length + result.failed.length;
    if (result.failed.length) {
      pill(
        MBS_I18N.t("pill.failed", {
          filled: result.filled.length,
          total: total,
          name: result.failed[0].name,
          error: result.failed[0].error,
        }),
        true,
        7000
      );
    } else {
      pill(MBS_I18N.t("pill.filled", { count: odmianaPol(result.filled.length), profile: active.name }));
    }

    var after = active.after || { action: "none" };
    if (after.action === "focus" && after.selector) {
      var target = resolve(after.selector);
      if (target) target.focus();
    } else if (after.action === "submit" && !result.failed.length) {
      var form = after.selector ? resolve(after.selector) : (result.filled[0] && result.filled[0].el.form);
      if (form) {
        if (form.requestSubmit) form.requestSubmit();
        else form.submit();
      }
    }
    notify({ cmd: "scan", profile: active.name, filled: result.filled.length, total: total, frame: frame });
  }

  // ------------------------------------------------------ tryb nauki ----

  var SEPARATORS = [";", "|", "\t", ","];
  // Formaty proponowane, gdy wskazana wartosc wyglada na date ("" = bez zmian).
  var FORMATY_DATY_PL = ["DD.MM.RRRR", "RRRR-MM-DD", "DD-MM-RR", "RRRRMMDD"];
  var FORMATY_CZASU_PL = ["DD.MM.RRRR HH:MI", "RRRR-MM-DD HH:MI:SS", "HH:MI"];
  var FORMATY_DATY_EN = ["DD.MM.YYYY", "YYYY-MM-DD", "DD-MM-YY", "YYYYMMDD"];
  var FORMATY_CZASU_EN = ["DD.MM.YYYY HH:MI", "YYYY-MM-DD HH:MI:SS", "HH:MI"];

  // Gdy wskazana wartosc wyglada na date, panel potwierdzania dostaje rzad
  // przyciskow z PODGLADEM na realnej wartosci: klikniecie zatwierdza pole
  // razem z formatem. "Zatwierdź i dalej" nadal wstawia wartosc bez zmian,
  // wiec przeplyw kreatora zostaje taki sam.
  function wierszFormatow(wartosc, el) {
    // Kontrolki HTML z wlasnym formatem (date/time/datetime-local) dostaja
    // swoj niezaleznie od profilu - nie ma o co pytac.
    if (el && (el.type === "date" || el.type === "time" || el.type === "datetime-local")) return "";
    var t = BRFill.parseDateTime(wartosc);
    if (!t) return "";
    var pl = MBS_I18N.getLang() === "pl";
    var daty = pl ? FORMATY_DATY_PL : FORMATY_DATY_EN;
    var czasy = pl ? FORMATY_CZASU_PL : FORMATY_CZASU_EN;
    var presety = t.maCzas ? czasy.concat(daty) : daty;
    return (
      "<p style='margin:10px 0 4px'>" +
      esc(
        MBS_I18N.t("learn.date.looksLike", {
          kind: MBS_I18N.t(t.maCzas ? "learn.date.withTime" : "learn.date.plain"),
        })
      ) +
      "</p>" +
      presety
        .map(function (wzorzec) {
          return (
            "<button class='ghost' data-act='format' data-format='" +
            esc(wzorzec) +
            "'>" +
            esc(BRFill.formatDate(wartosc, wzorzec)) +
            "</button>"
          );
        })
        .join(" ") +
      "<div class='wlasny'><input data-field='format' placeholder='" +
      esc(MBS_I18N.t("learn.date.customPlaceholder")) +
      "'><button data-act='format-custom'>" +
      esc(MBS_I18N.t("learn.date.use")) +
      "</button></div><div class='podglad'></div>"
    );
  }

  function startLearn() {
    learn = { step: "scan", buf: "", lastTs: 0, frame: "", names: [], separator: ";", index: 0, fields: {}, pending: null, marked: null };
    renderLearn();
  }

  // Trwale zaznaczenie wybranego (niezatwierdzonego) pola.
  function markLearn(el) {
    unmarkLearn();
    if (!el) return;
    learn.marked = el;
    el.__brPrevOutline = el.style.outline;
    el.style.outline = "3px solid #16a34a";
  }

  function unmarkLearn() {
    if (learn && learn.marked) {
      learn.marked.style.outline = learn.marked.__brPrevOutline || "";
      delete learn.marked.__brPrevOutline;
      learn.marked = null;
    }
  }

  function odepnijWybor() {
    document.removeEventListener("mousedown", onLearnMouseDown, true);
    document.removeEventListener("click", onLearnClick, true);
    document.removeEventListener("mouseover", onLearnHover, true);
  }

  function stopLearn() {
    unmarkLearn();
    learn = null;
    if (ui) ui.panel.style.display = "none";
    odepnijWybor();
    evaluate();
  }

  function onLearnKey(ev) {
    if (learn.step !== "scan") return;
    if (ev.key === "Enter") {
      ev.preventDefault();
      ev.stopPropagation();
      if (!learn.buf) return;
      learn.frame = learn.buf;
      learn.separator = pickSeparator(learn.frame);
      learn.names = learn.frame.split(learn.separator).map(function (part, i) {
        return i === 0 && learn.frame.split(learn.separator).length > 1 ? "_" : "pole" + i;
      });
      learn.step = "names";
      renderLearn();
      return;
    }
    // TAB jest czescia ramki TAB-owej z profilu urzadzenia - buforujemy go
    // jak znak (i nie pozwalamy mu ruszyc fokusa).
    if (ev.key.length !== 1 && ev.key !== "Tab") return;
    ev.preventDefault();
    ev.stopPropagation();
    var now = performance.now();
    if (now - learn.lastTs > 400) learn.buf = "";
    learn.lastTs = now;
    learn.buf += ev.key === "Tab" ? "\t" : ev.key;
  }

  function pickSeparator(frame) {
    var best = SEPARATORS[0];
    var bestCount = 1;
    SEPARATORS.forEach(function (sep) {
      var count = frame.split(sep).length;
      if (count > bestCount) {
        bestCount = count;
        best = sep;
      }
    });
    return best;
  }

  function esc(text) {
    return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function renderLearn() {
    var u = ensureUi();
    u.panel.style.display = "block";
    hidePill();

    if (learn.step === "scan") {
      u.panel.innerHTML =
        "<h2>" + esc(MBS_I18N.t("learn.step1.title")) + "</h2><p>" +
        MBS_I18N.t("learn.step1.body") +
        "</p><button class='ghost' data-act='cancel'>" + esc(MBS_I18N.t("learn.cancel")) + "</button>";
    } else if (learn.step === "names") {
      var parts = learn.frame.split(learn.separator);
      var rows = parts
        .map(function (part, i) {
          return (
            "<div class='row'><code>" +
            esc(part) +
            "</code><input data-idx='" +
            i +
            "' value='" +
            esc(learn.names[i] || "") +
            "'></div>"
          );
        })
        .join("");
      u.panel.innerHTML =
        "<h2>" + esc(MBS_I18N.t("learn.step2.title")) + "</h2><p>" +
        MBS_I18N.t("learn.step2.body") +
        "</p><div class='rows'>" +
        rows +
        "</div><button data-act='names'>" + esc(MBS_I18N.t("learn.next")) + "</button>" +
        "<button class='ghost' data-act='back'>" + esc(MBS_I18N.t("learn.backRescan")) + "</button>" +
        "<button class='ghost' data-act='cancel'>" + esc(MBS_I18N.t("learn.cancel")) + "</button>";
    } else if (learn.step === "pick") {
      var name = learn.names[learn.index];
      var value = learn.frame.split(learn.separator)[learn.index];
      if (learn.pending) {
        // pole wybrane - czeka na potwierdzenie (mozna zmienic albo sie cofnac)
        u.panel.innerHTML =
          "<h2>" + esc(MBS_I18N.t("learn.step3.title")) + "</h2><p>" +
          MBS_I18N.t("learn.step3.chosen", { field: esc(name), value: esc(value) }) +
          "</p><p><code>" +
          esc(learn.pending.selector) +
          "</code></p>" +
          "<button data-act='confirm'>" + esc(MBS_I18N.t("learn.confirm")) + "</button>" +
          "<button class='ghost' data-act='repick'>" + esc(MBS_I18N.t("learn.repick")) + "</button>" +
          "<button class='ghost' data-act='back'>" + esc(MBS_I18N.t("learn.back")) + "</button>" +
          "<button class='ghost' data-act='cancel'>" + esc(MBS_I18N.t("learn.cancel")) + "</button>" +
          wierszFormatow(value, resolve(learn.pending.selector));
      } else {
        u.panel.innerHTML =
          "<h2>" + esc(MBS_I18N.t("learn.step3.title")) + "</h2><p>" +
          MBS_I18N.t("learn.step3.body", { field: esc(name), value: esc(value) }) +
          "</p>" +
          "<button class='ghost' data-act='back'>" + esc(MBS_I18N.t("learn.back")) + "</button>" +
          "<button class='ghost' data-act='skip'>" + esc(MBS_I18N.t("learn.skip")) + "</button>" +
          "<button class='ghost' data-act='cancel'>" + esc(MBS_I18N.t("learn.cancel")) + "</button>";
      }
    } else if (learn.step === "save") {
      u.panel.innerHTML =
        "<h2>" + esc(MBS_I18N.t("learn.save.title")) + "</h2><p>" +
        MBS_I18N.t("learn.save.body") +
        "</p><input data-field='name' value='" +
        esc(document.title || MBS_I18N.t("learn.save.defaultName")) +
        "'><input data-field='url' value='" +
        esc(location.origin + location.pathname + "*") +
        "'><input data-field='prefix' value='" +
        esc(learn.frame.split(learn.separator)[0] + learn.separator) +
        "' placeholder='" + esc(MBS_I18N.t("learn.save.prefixPlaceholder")) + "'>" +
        "<button data-act='save'>" + esc(MBS_I18N.t("learn.save.button")) + "</button>" +
        "<button class='ghost' data-act='back'>" + esc(MBS_I18N.t("learn.back")) + "</button>" +
        "<button class='ghost' data-act='cancel'>" + esc(MBS_I18N.t("learn.cancel")) + "</button>";
    }
    u.panel.querySelectorAll("button").forEach(function (button) {
      button.addEventListener("click", onLearnButton);
    });
    var poleFormatu = u.panel.querySelector("input[data-field='format']");
    if (poleFormatu) {
      poleFormatu.addEventListener("input", function () {
        var podglad = u.panel.querySelector(".podglad");
        var surowa = learn.frame.split(learn.separator)[learn.index];
        podglad.textContent = poleFormatu.value ? BRFill.formatDate(surowa, poleFormatu.value) : "";
      });
    }
  }

  function onLearnButton(ev) {
    var action = ev.currentTarget.getAttribute("data-act");
    if (action === "cancel") return stopLearn();
    if (action === "names") {
      var inputs = ui.panel.querySelectorAll("input[data-idx]");
      learn.names = Array.prototype.map.call(inputs, function (input) {
        return input.value.trim();
      });
      learn.index = -1;
      return nextPick();
    }
    if (action === "confirm" || action === "format" || action === "format-custom") {
      // "format"/"format-custom" to zatwierdzenie z przeliczeniem daty.
      var wzorzec = "";
      if (action === "format") wzorzec = ev.currentTarget.getAttribute("data-format");
      if (action === "format-custom") {
        var polePatternu = ui.panel.querySelector("input[data-field='format']");
        wzorzec = polePatternu ? polePatternu.value.trim() : "";
      }
      learn.fields[learn.names[learn.index]] = wzorzec
        ? { selector: learn.pending.selector, format: wzorzec }
        : learn.pending.selector;
      unmarkLearn();
      learn.pending = null;
      return nextPick();
    }
    if (action === "repick") {
      unmarkLearn();
      learn.pending = null;
      return renderLearn();
    }
    if (action === "back") {
      if (learn.step === "names") {
        learn.step = "scan";
        return renderLearn();
      }
      if (learn.step === "save") {
        learn.index = learn.names.length; // cofnij do ostatniego pola
      }
      return prevPick();
    }
    if (action === "skip") {
      delete learn.fields[learn.names[learn.index]]; // pomijane = bez przypisania
      unmarkLearn();
      learn.pending = null;
      return nextPick();
    }
    if (action === "save") return saveLearned();
  }

  // Wejscie w krok wyboru dla biezacej nazwy; wczesniejsze przypisanie
  // (np. po cofnieciu) pokazuje sie jako wybor do zatwierdzenia.
  function enterPick() {
    learn.step = "pick";
    var existing = BRFill.selectorOf(learn.fields[learn.names[learn.index]]);
    learn.pending = existing ? { selector: existing } : null;
    markLearn(existing ? resolve(existing) : null);
    document.addEventListener("mousedown", onLearnMouseDown, true);
    document.addEventListener("click", onLearnClick, true);
    document.addEventListener("mouseover", onLearnHover, true);
    renderLearn();
  }

  function nextPick() {
    do {
      learn.index += 1;
    } while (learn.index < learn.names.length && (!learn.names[learn.index] || learn.names[learn.index] === "_"));

    if (learn.index >= learn.names.length) {
      learn.step = "save";
      unmarkLearn();
      learn.pending = null;
      odepnijWybor();
      renderLearn();
      return;
    }
    enterPick();
  }

  function prevPick() {
    do {
      learn.index -= 1;
    } while (learn.index >= 0 && (!learn.names[learn.index] || learn.names[learn.index] === "_"));

    if (learn.index < 0) {
      // przed pierwszym polem - wroc do nazywania segmentow
      learn.step = "names";
      unmarkLearn();
      learn.pending = null;
      odepnijWybor();
      renderLearn();
      return;
    }
    enterPick();
  }

  function isFormField(el) {
    if (!el || !el.tagName) return false;
    if (el.isContentEditable) return true;
    return ["INPUT", "SELECT", "TEXTAREA"].indexOf(el.tagName) >= 0 && el.type !== "password";
  }

  // Natywna lista <select> otwiera sie na mousedown - w trybie wyboru pola
  // musimy ja zatrzymac wczesniej niz na "click".
  function onLearnMouseDown(ev) {
    if (ev.composedPath().indexOf(ui.host) >= 0) return;
    if (!isFormField(ev.target)) return;
    ev.preventDefault();
    ev.stopPropagation();
  }

  function onLearnHover(ev) {
    if (ev.composedPath().indexOf(ui.host) >= 0) return;
    var el = ev.target;
    if (isFormField(el)) highlight(el, true);
  }

  function onLearnClick(ev) {
    if (ev.composedPath().indexOf(ui.host) >= 0) return;
    var el = ev.target;
    if (!isFormField(el)) return;
    ev.preventDefault();
    ev.stopPropagation();
    // klik = WYBOR (do zatwierdzenia w panelu), nie automatyczne przejscie -
    // operator moze potwierdzic, wybrac inne pole albo sie cofnac
    learn.pending = { selector: cssPath(el) };
    markLearn(el);
    renderLearn();
  }

  // Selektor: najpierw stabilne atrybuty, sciezka strukturalna na koncu.
  function looksGenerated(id) {
    return /[0-9]{4,}/.test(id) || /^[a-z]+[-_][0-9a-f]{6,}$/i.test(id);
  }

  function unique(selector) {
    try {
      return document.querySelectorAll(selector).length === 1;
    } catch (e) {
      return false;
    }
  }

  function cssPath(el) {
    var tag = el.tagName.toLowerCase();
    if (el.name) {
      var byName = tag + '[name="' + el.name + '"]';
      if (unique(byName)) return byName;
    }
    if (el.id && !looksGenerated(el.id) && unique("#" + CSS.escape(el.id))) return "#" + CSS.escape(el.id);
    var attrs = ["data-testid", "data-test", "data-qa", "aria-label", "placeholder"];
    for (var i = 0; i < attrs.length; i += 1) {
      var value = el.getAttribute(attrs[i]);
      if (!value) continue;
      var bySelector = tag + "[" + attrs[i] + '="' + value.replace(/"/g, '\\"') + '"]';
      if (unique(bySelector)) return bySelector;
    }
    var parts = [];
    var node = el;
    while (node && node.nodeType === 1 && parts.length < 6) {
      var step = node.tagName.toLowerCase();
      var parent = node.parentElement;
      if (parent) {
        var siblings = Array.prototype.filter.call(parent.children, function (child) {
          return child.tagName === node.tagName;
        });
        if (siblings.length > 1) step += ":nth-of-type(" + (siblings.indexOf(node) + 1) + ")";
      }
      parts.unshift(step);
      if (node.id && !looksGenerated(node.id)) {
        parts.unshift("#" + CSS.escape(node.id));
        break;
      }
      node = parent;
    }
    return parts.join(" > ");
  }

  function saveLearned() {
    var read = function (field) {
      var input = ui.panel.querySelector('input[data-field="' + field + '"]');
      return input ? input.value.trim() : "";
    };
    var profile = {
      id: "profil-" + Date.now().toString(36),
      name: read("name") || "Formularz",
      enabled: true,
      match: { urlPattern: read("url") || location.origin + location.pathname + "*", requiredFields: Object.keys(learn.fields).slice(0, 2) },
      parse: {
        type: "delimited",
        prefix: read("prefix"),
        separator: learn.separator,
        fields: learn.names,
      },
      fields: learn.fields,
      after: { action: "none" },
    };
    state.profiles.push(profile);
    BRStore.save(state).then(function (saved) {
      state = saved;
      stopLearn();
      pill("Zapisano profil: " + profile.name);
    });
  }

  // ------------------------------------------------------------ start ----

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.cmd === "learn") {
      startLearn();
      sendResponse({ ok: true });
    } else if (message.cmd === "status") {
      sendResponse({ ok: true, active: active ? active.name : null, enabled: state ? state.enabled : true });
    } else if (message.cmd === "reload") {
      BRStore.load().then(function (loaded) {
        state = loaded;
        evaluate();
        sendResponse({ ok: true });
      });
      return true;
    }
    return false;
  });

  MBS_I18N.load();
  BRStore.load().then(function (loaded) {
    state = loaded;
    document.addEventListener("keydown", onKeyDown, true);
    watchPage();
    evaluate();
  });
})();
