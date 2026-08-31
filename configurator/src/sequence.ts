// Mini-jezyk sekwencji akcji:
//   {pole}    -> {"type":"field","name":"pole"}
//   "tekst"   -> {"type":"text","value":"tekst"}
//   TAB/ENTER/... -> {"type":"key","key":"TAB"}
// Dwukierunkowa konwersja: tekst <-> lista akcji.
import { Action, KEY_NAMES } from "./schema";
import { t } from "./i18n";

export function parseSequence(input: string): { actions: Action[]; errors: string[] } {
  const actions: Action[] = [];
  const errors: string[] = [];
  const re = /\{([^}]*)\}|"([^"]*)"|(\S+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    if (m[1] !== undefined) {
      const name = m[1].trim();
      if (!name) errors.push(t("seq.emptyField"));
      else actions.push({ type: "field", name });
    } else if (m[2] !== undefined) {
      actions.push({ type: "text", value: m[2] });
    } else {
      const token = m[3].toUpperCase();
      if ((KEY_NAMES as readonly string[]).includes(token)) {
        actions.push({ type: "key", key: token as Action extends { key: infer K } ? K : never });
      } else {
        errors.push(t("seq.unknownToken", { token: m[3], keys: KEY_NAMES.join(" ") }));
      }
    }
  }
  if (actions.length === 0 && errors.length === 0) errors.push(t("seq.empty"));
  return { actions, errors };
}

export function formatSequence(actions: Action[]): string {
  return actions
    .map((a) => {
      if (a.type === "field") return `{${a.name}}`;
      if (a.type === "text") return `"${a.value}"`;
      return a.key;
    })
    .join(" ");
}

// Mapa pol: "firstName=1, lastName=2" <-> {firstName:1, lastName:2}
export function parseFields(input: string): { fields: Record<string, number>; errors: string[] } {
  const fields: Record<string, number> = {};
  const errors: string[] = [];
  const parts = input.split(",").map((s) => s.trim()).filter(Boolean);
  if (parts.length === 0) errors.push(t("seq.giveFields"));
  for (const part of parts) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([0-9]+)$/.exec(part);
    if (!m) {
      errors.push(t("seq.badField", { part }));
      continue;
    }
    fields[m[1]] = parseInt(m[2], 10);
  }
  return { fields, errors };
}

export function formatFields(fields: Record<string, number>): string {
  return Object.entries(fields)
    .sort((a, b) => a[1] - b[1])
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
}
