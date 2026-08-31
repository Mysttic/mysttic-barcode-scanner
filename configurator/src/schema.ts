// Walidacja konfiguracji (zod) - lustrzana wobec walidatora w firmware.
//
// Komunikaty przechodza przez t() w miejscu walidacji (superRefine), a nie
// w argumencie .min()/.refine() - inaczej zostalyby zamrozone w jezyku, ktory
// obowiazywal przy ladowaniu modulu, i przelacznik jezyka by ich nie ruszyl.
import { z } from "zod";
import { t } from "./i18n";

export const KEY_NAMES = [
  "TAB", "ENTER", "ESC", "BACKSPACE", "UP", "DOWN", "LEFT", "RIGHT",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
] as const;

const keyName = z.enum(KEY_NAMES);

// CircuitPython `re` nie wspiera {m,n} - blokujemy klamry juz tutaj.
const cpRegex = z.string().superRefine((p, ctx) => {
  const fail = (key: string): void => {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: t(key) });
  };
  if (p.length === 0) return fail("val.emptyPattern");
  if (p.includes("{") || p.includes("}")) return fail("val.braces");
  try {
    new RegExp(p);
  } catch {
    fail("val.badRegex");
  }
});

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("field"), name: z.string().min(1) }),
  z.object({ type: z.literal("key"), key: keyName }),
  z.object({ type: z.literal("text"), value: z.string() }),
]);

export const GS1_FIELDS = ["gtin", "expiry", "expiryISO", "batch", "serial", "aim"] as const;

const parseSpec = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("regexGroups"),
    pattern: cpRegex.optional(),
    fields: z.record(z.string().min(1), z.number().int().min(1)),
  }),
  z.object({ type: z.literal("gs1") }),
]);

const profile = z
  .object({
    name: z.string(),
    enabled: z.boolean(),
    detect: z.object({ type: z.literal("regex"), pattern: cpRegex }),
    parse: parseSpec,
    output: z.array(action),
  })
  .superRefine((p, ctx) => {
    if (p.name.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["name"], message: t("val.profileName") });
    }
    if (p.output.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["output"], message: t("val.emptySequence") });
    }
    const known =
      p.parse.type === "gs1" ? (GS1_FIELDS as readonly string[]) : Object.keys(p.parse.fields);
    p.output.forEach((a, i) => {
      if (a.type === "field" && !known.includes(a.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["output", i],
          message: t("val.unknownField", { field: a.name, known: known.join(", ") }),
        });
      }
    });
    if (p.parse.type === "regexGroups" && Object.keys(p.parse.fields).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parse", "fields"], message: t("val.needField") });
    }
  });

export const configSchema = z
  .object({
    version: z.literal(1),
    device: z.object({
      keyboardLayout: z.string(),
      keyDelayMs: z.number().int().min(0).max(500),
      actionDelayMs: z.number().int().min(0).max(1000).default(30),
    }),
    scanner: z.object({
      baudrate: z.union([
        z.literal(1200), z.literal(4800), z.literal(9600), z.literal(14400),
        z.literal(19200), z.literal(38400), z.literal(57600), z.literal(115200),
      ]),
      terminators: z.array(z.string().regex(/^[0-9A-Fa-f]+$/)),
      frameTimeoutMs: z.number().int().min(50).max(5000),
      duplicateBlockMs: z.number().int().min(0).max(10000).default(1500),
    }),
    output: z.object({
      mode: z.enum(["passthrough", "split"]),
      suffixKey: keyName.or(z.literal("")),
      splitAt: z.number().int().min(1).optional(),
      prefixText: z.string().default(""),
      suffixText: z.string().default(""),
      onError: z.enum(["raw", "skip"]).default("raw"),
    }),
    profiles: z.array(profile),
  })
  .superRefine((cfg, ctx) => {
    const names = cfg.profiles.map((p) => p.name);
    names.forEach((n, i) => {
      if (names.indexOf(n) !== i) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["profiles", i, "name"],
          message: t("val.duplicateName", { name: n }),
        });
      }
    });
  });

export type Config = z.infer<typeof configSchema>;
export type Profile = z.infer<typeof profile>;
export type Action = z.infer<typeof action>;
