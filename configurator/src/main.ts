// Konfigurator czytnika (Etap 7): WebSerial + NDJSON + edycja profili.
import "./style.css";
import { Action, Config, KEY_NAMES, Profile, configSchema } from "./schema";
import { DeviceLink } from "./serial";
import { formatFields, formatSequence, parseFields, parseSequence } from "./sequence";
import { applyI18n, getLang, setLang, t, type Lang } from "./i18n";

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

const link = new DeviceLink();
let config: Config | null = null;

// ---------- polaczenie ----------
const elStatus = $("conn-status");
const elDevInfo = $("dev-info");
const elApp = $("app");

function setConnected(on: boolean): void {
  elStatus.textContent = on ? t("conn.connected") : t("conn.disconnected");
  elStatus.className = "badge " + (on ? "on" : "off");
  $("btn-connect").hidden = on;
  $("btn-disconnect").hidden = !on;
  elApp.hidden = !on;
  if (!on) elDevInfo.textContent = "";
}

$("btn-connect").addEventListener("click", async () => {
  if (!("serial" in navigator)) {
    alert(t("conn.noWebSerial"));
    return;
  }
  try {
    await link.connect();
    const pong = await link.command("ping");
    const fw = String(pong.fw ?? t("conn.olderThan"));
    elDevInfo.textContent = t("conn.info", { fw, version: String(pong.version), mode: String(pong.mode) });
    $("fw-version").textContent = fw;
    setConnected(true);
    await reloadFromDevice();
  } catch (e) {
    alert(t("conn.failed") + (e as Error).message);
    await link.disconnect();
  }
});
$("btn-disconnect").addEventListener("click", () => void link.disconnect());
link.onDisconnect = () => setConnected(false);

// ---------- eventy (tryb testowy) ----------
const elTestLog = $("test-log");
link.onEvent = (obj) => {
  if (obj.event === "scan") {
    const div = document.createElement("div");
    div.className = "scan-entry";
    const fields = obj.fields && Object.keys(obj.fields as object).length
      ? t("test.fields") + JSON.stringify(obj.fields)
      : "";
    const profile = obj.profile
      ? `${t("test.profile")}<span class="p">${escapeHtml(String(obj.profile))}</span>`
      : t("test.noProfile");
    let text = "";
    try {
      text = atob(String(obj.rawBase64));
    } catch {
      text = t("test.nonAscii") + String(obj.hex);
    }
    div.innerHTML = `<b>${escapeHtml(text)}</b>${profile}${escapeHtml(fields)}`;
    elTestLog.prepend(div);
  }
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

$("chk-testmode").addEventListener("change", async (ev) => {
  const on = (ev.target as HTMLInputElement).checked;
  try {
    await link.command("setMode", { mode: on ? "test" : "hid" });
    if (on) elTestLog.textContent = "";
  } catch (e) {
    alert(t("test.modeError") + (e as Error).message);
  }
});

// ---------- urzadzenie ----------
const selSuffix = $("dev-suffix") as unknown as HTMLSelectElement;
function fillSuffixOptions(): void {
  const keep = selSuffix.value;
  selSuffix.innerHTML =
    `<option value="">${t("device.none")}</option>` + KEY_NAMES.map((k) => `<option>${k}</option>`).join("");
  selSuffix.value = keep;
}
fillSuffixOptions();

// ---------- profile ----------
const elProfiles = $("profiles-list");

interface ProfileRow {
  root: HTMLElement;
  get(): { profile: Profile | null; errors: string[] };
}
let profileRows: ProfileRow[] = [];

function addProfileRow(p: Profile): void {
  const root = document.createElement("div");
  root.className = "profile-card" + (p.enabled ? "" : " disabled");
  root.innerHTML = `
    <div class="profile-head">
      <label class="switch"><input type="checkbox" class="p-enabled"> <span data-i18n="profile.enabled"></span></label>
      <input type="text" class="p-name" data-i18n-ph="profile.namePlaceholder" />
      <span class="spacer"></span>
      <button class="p-del" data-i18n="profile.delete"></button>
    </div>
    <div class="grid">
      <label><span data-i18n="profile.parseType"></span>
        <select class="p-ptype">
          <option value="regexGroups" data-i18n="profile.parseType.regexGroups"></option>
          <option value="gs1" data-i18n="profile.parseType.gs1"></option>
        </select>
      </label>
      <label><span data-i18n="profile.detect"></span> <input type="text" class="p-detect" /></label>
      <label><span data-i18n="profile.parse"></span> <input type="text" class="p-parse" /></label>
      <label><span data-i18n="profile.fields"></span> <input type="text" class="p-fields" /></label>
      <label><span data-i18n="profile.sequence"></span> <input type="text" class="p-seq" /></label>
    </div>
    <div class="hint p-gs1hint" hidden data-i18n="profile.gs1hint"></div>
    <div class="field-error p-err"></div>`;
  applyI18n(root);
  const q = <T extends HTMLElement>(cls: string): T => root.querySelector("." + cls) as T;
  (q<HTMLInputElement>("p-enabled")).checked = p.enabled;
  (q<HTMLInputElement>("p-name")).value = p.name;
  (q<HTMLInputElement>("p-detect")).value = p.detect.pattern;
  (q<HTMLSelectElement>("p-ptype")).value = p.parse.type;
  (q<HTMLInputElement>("p-parse")).value = p.parse.type === "regexGroups" ? (p.parse.pattern ?? "") : "";
  (q<HTMLInputElement>("p-fields")).value = p.parse.type === "regexGroups" ? formatFields(p.parse.fields) : "";
  (q<HTMLInputElement>("p-seq")).value = formatSequence(p.output);
  const syncPtype = (): void => {
    const gs1 = (q<HTMLSelectElement>("p-ptype")).value === "gs1";
    (q<HTMLInputElement>("p-parse")).disabled = gs1;
    (q<HTMLInputElement>("p-fields")).disabled = gs1;
    (q<HTMLElement>("p-gs1hint")).hidden = !gs1;
  };
  syncPtype();
  q<HTMLSelectElement>("p-ptype").addEventListener("change", syncPtype);
  q<HTMLInputElement>("p-enabled").addEventListener("change", (ev) => {
    root.classList.toggle("disabled", !(ev.target as HTMLInputElement).checked);
  });
  q("p-del").addEventListener("click", () => {
    profileRows = profileRows.filter((r) => r.root !== root);
    root.remove();
  });

  const row: ProfileRow = {
    root,
    get() {
      const errors: string[] = [];
      const name = q<HTMLInputElement>("p-name").value.trim();
      const gs1 = (q<HTMLSelectElement>("p-ptype")).value === "gs1";
      const seqRes = parseSequence(q<HTMLInputElement>("p-seq").value);
      errors.push(...seqRes.errors);
      let parse: Profile["parse"];
      if (gs1) {
        parse = { type: "gs1" };
      } else {
        const fieldsRes = parseFields(q<HTMLInputElement>("p-fields").value);
        errors.push(...fieldsRes.errors);
        const parsePattern = q<HTMLInputElement>("p-parse").value.trim();
        parse = {
          type: "regexGroups",
          ...(parsePattern ? { pattern: parsePattern } : {}),
          fields: fieldsRes.fields,
        };
      }
      const profile: Profile = {
        name,
        enabled: q<HTMLInputElement>("p-enabled").checked,
        detect: { type: "regex", pattern: q<HTMLInputElement>("p-detect").value.trim() },
        parse,
        output: seqRes.actions as Action[],
      };
      q("p-err").textContent = errors.join("; ");
      return {
        profile: errors.length ? null : profile,
        errors: errors.map((e) => `${name || t("profile.unnamed")}: ${e}`),
      };
    },
  };
  profileRows.push(row);
  elProfiles.appendChild(root);
}

$("btn-add-profile").addEventListener("click", () => {
  addProfileRow({
    name: t("profile.new"),
    enabled: false,
    detect: { type: "regex", pattern: "^.*$" },
    parse: { type: "regexGroups", pattern: "^(.*)$", fields: { kod: 1 } },
    output: [{ type: "field", name: "kod" }, { type: "key", key: "ENTER" }],
  });
});

// ---------- config <-> UI ----------
function uiFromConfig(cfg: Config): void {
  ($("dev-keydelay") as HTMLInputElement).value = String(cfg.device.keyDelayMs);
  ($("dev-actiondelay") as HTMLInputElement).value = String(cfg.device.actionDelayMs);
  ($("dev-dupblock") as HTMLInputElement).value = String(cfg.scanner.duplicateBlockMs);
  ($("dev-prefixtext") as HTMLInputElement).value = cfg.output.prefixText;
  ($("dev-suffixtext") as HTMLInputElement).value = cfg.output.suffixText;
  ($("dev-onerror") as HTMLSelectElement).value = cfg.output.onError;
  selSuffix.value = cfg.output.suffixKey;
  ($("dev-outmode") as HTMLSelectElement).value = cfg.output.mode;
  ($("dev-splitat") as HTMLInputElement).value = String(cfg.output.splitAt ?? 4);
  elProfiles.innerHTML = "";
  profileRows = [];
  cfg.profiles.forEach(addProfileRow);
}

function configFromUi(): { cfg: Config | null; errors: string[] } {
  if (!config) return { cfg: null, errors: [t("msg.noBaseConfig")] };
  const errors: string[] = [];
  const profiles: Profile[] = [];
  for (const row of profileRows) {
    const r = row.get();
    if (r.profile) profiles.push(r.profile);
    errors.push(...r.errors);
  }
  const candidate = {
    ...config,
    device: {
      ...config.device,
      keyDelayMs: parseInt(($("dev-keydelay") as HTMLInputElement).value || "10", 10),
      actionDelayMs: parseInt(($("dev-actiondelay") as HTMLInputElement).value || "30", 10),
    },
    scanner: {
      ...config.scanner,
      duplicateBlockMs: parseInt(($("dev-dupblock") as HTMLInputElement).value || "1500", 10),
    },
    output: {
      ...config.output,
      mode: ($("dev-outmode") as HTMLSelectElement).value as "passthrough" | "split",
      suffixKey: selSuffix.value as Config["output"]["suffixKey"],
      splitAt: parseInt(($("dev-splitat") as HTMLInputElement).value || "4", 10),
      prefixText: ($("dev-prefixtext") as HTMLInputElement).value,
      suffixText: ($("dev-suffixtext") as HTMLInputElement).value,
      onError: ($("dev-onerror") as HTMLSelectElement).value as "raw" | "skip",
    },
    profiles,
  };
  if (errors.length) return { cfg: null, errors };
  const parsed = configSchema.safeParse(candidate);
  if (!parsed.success) {
    return { cfg: null, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  return { cfg: parsed.data, errors: [] };
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return "[" + v.map(canonical).join(",") + "]";
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return "{" + Object.keys(o).sort().map((k) => JSON.stringify(k) + ":" + canonical(o[k])).join(",") + "}";
  }
  return JSON.stringify(v);
}

const elValidation = $("validation");
function showValidation(errors: string[]): void {
  elValidation.hidden = errors.length === 0;
  elValidation.textContent = errors.join("\n");
}

async function reloadFromDevice(): Promise<void> {
  const resp = await link.command("getConfig");
  const parsed = configSchema.safeParse(resp.config);
  if (!parsed.success) {
    showValidation([t("msg.deviceConfigInvalid"), ...parsed.error.issues.map((i) => i.message)]);
    return;
  }
  config = parsed.data;
  uiFromConfig(config);
  showValidation([]);
}

// ---------- akcje ----------
$("btn-reload").addEventListener("click", () => void reloadFromDevice());

async function applyToDevice(): Promise<Config | null> {
  const { cfg, errors } = configFromUi();
  showValidation(errors);
  if (!cfg) return null;
  const resp = await link.command("setConfig", { config: cfg });
  if (!resp.ok) {
    showValidation([String(resp.error), ...((resp.details as string[]) ?? [])]);
    return null;
  }
  config = cfg;
  return cfg;
}

$("btn-apply").addEventListener("click", async () => {
  const cfg = await applyToDevice();
  if (cfg) showValidation([t("msg.applied")]);
});

$("btn-save").addEventListener("click", async () => {
  const cfg = await applyToDevice();
  if (!cfg) return;
  const resp = await link.command("save");
  if (!resp.ok) {
    showValidation([String(resp.error)]);
    return;
  }
  // weryfikacja: pobierz ponownie i porownaj NIEZALEZNIE od kolejnosci kluczy
  const back = await link.command("getConfig");
  const same = canonical(back.config) === canonical(cfg);
  showValidation([same ? t("msg.saved") : t("msg.savedMismatch")]);
});

$("btn-export").addEventListener("click", () => {
  const { cfg, errors } = configFromUi();
  showValidation(errors);
  if (!cfg) return;
  const blob = new Blob([JSON.stringify(cfg, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "config.json";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("btn-import").addEventListener("click", () => $("file-import").click());
$("file-import").addEventListener("change", async (ev) => {
  const file = (ev.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const parsed = configSchema.safeParse(JSON.parse(await file.text()));
    if (!parsed.success) {
      showValidation(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`));
      return;
    }
    config = parsed.data;
    uiFromConfig(config);
    showValidation([t("msg.imported")]);
  } catch (e) {
    showValidation([t("msg.importError") + (e as Error).message]);
  }
  (ev.target as HTMLInputElement).value = "";
});

$("btn-factory").addEventListener("click", async () => {
  if (!confirm(t("service.factoryConfirm"))) return;
  await link.command("factoryReset");
  await reloadFromDevice();
});

$("btn-reboot").addEventListener("click", async () => {
  await link.command("reboot").catch(() => undefined);
  await link.disconnect();
});

const bootloaderFlow = async (): Promise<void> => {
  if (!confirm(t("service.bootloaderConfirm"))) return;
  await link.command("rebootBootloader").catch(() => undefined);
  await link.disconnect();
};
$("btn-bootloader").addEventListener("click", () => void bootloaderFlow());
$("btn-update-bootloader").addEventListener("click", () => void bootloaderFlow());

const RELEASES_URL = "https://github.com/Mysttic/mysttic-barcode-scanner/releases";
($("fw-releases") as HTMLAnchorElement).href = RELEASES_URL;

// ---------- zakladki ----------
const TAB_IDS = ["sec-device", "sec-profiles", "sec-test", "sec-update", "sec-actions"];
document.querySelectorAll<HTMLButtonElement>("#tabs .tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#tabs .tab").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    TAB_IDS.forEach((id) => ($(id).hidden = id !== btn.dataset.tab));
  });
});

setConnected(false);

// ---------- jezyk ----------
const selLang = $("sel-lang") as unknown as HTMLSelectElement;
selLang.value = getLang();
selLang.addEventListener("change", () => {
  setLang(selLang.value as Lang);
  fillSuffixOptions();
});
applyI18n();
