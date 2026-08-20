// Walidacja konfiguracji (zod) - lustrzana wobec walidatora w firmware.
import { z } from "zod";

export const KEY_NAMES = [
  "TAB", "ENTER", "ESC", "BACKSPACE", "UP", "DOWN", "LEFT", "RIGHT",
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10", "F11", "F12",
] as const;

const keyName = z.enum(KEY_NAMES);

// CircuitPython `re` nie wspiera {m,n} - blokujemy klamry juz tutaj.
const cpRegex = z
  .string()
  .min(1, "wzorzec nie może być pusty")
  .refine((p) => !p.includes("{") && !p.includes("}"), {
    message: "kwantyfikatory {m,n} nie działają na urządzeniu — rozpisz jawnie",
  })
  .refine(
    (p) => {
      try {
        new RegExp(p);
        return true;
      } catch {
        return false;
      }
    },
    { message: "błędny wyraz regularny" },
  );

const action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("field"), name: z.string().min(1) }),
  z.object({ type: z.literal("key"), key: keyName }),
  z.object({ type: z.literal("text"), value: z.string() }),
]);

const profile = z
  .object({
    name: z.string().min(1, "profil musi mieć nazwę"),
    enabled: z.boolean(),
    detect: z.object({ type: z.literal("regex"), pattern: cpRegex }),
    parse: z.object({
      type: z.literal("regexGroups"),
      pattern: cpRegex.optional(),
      fields: z.record(z.string().min(1), z.number().int().min(1)),
    }),
    output: z.array(action).min(1, "sekwencja nie może być pusta"),
  })
  .superRefine((p, ctx) => {
    const known = Object.keys(p.parse.fields);
    p.output.forEach((a, i) => {
      if (a.type === "field" && !known.includes(a.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["output", i],
          message: `pole "{${a.name}}" nie istnieje w mapie pól`,
        });
      }
    });
    if (Object.keys(p.parse.fields).length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["parse", "fields"], message: "podaj co najmniej jedno pole" });
    }
  });

export const configSchema = z
  .object({
    version: z.literal(1),
    device: z.object({
      keyboardLayout: z.string(),
      keyDelayMs: z.number().int().min(0).max(500),
    }),
    scanner: z.object({
      baudrate: z.union([
        z.literal(1200), z.literal(4800), z.literal(9600), z.literal(14400),
        z.literal(19200), z.literal(38400), z.literal(57600), z.literal(115200),
      ]),
      terminators: z.array(z.string().regex(/^[0-9A-Fa-f]+$/)),
      frameTimeoutMs: z.number().int().min(50).max(5000),
    }),
    output: z.object({
      mode: z.enum(["passthrough", "split"]),
      suffixKey: keyName.or(z.literal("")),
      splitAt: z.number().int().min(1).optional(),
    }),
    profiles: z.array(profile),
  })
  .superRefine((cfg, ctx) => {
    const names = cfg.profiles.map((p) => p.name);
    names.forEach((n, i) => {
      if (names.indexOf(n) !== i) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["profiles", i, "name"], message: `zdublowana nazwa "${n}"` });
      }
    });
  });

export type Config = z.infer<typeof configSchema>;
export type Profile = z.infer<typeof profile>;
export type Action = z.infer<typeof action>;
