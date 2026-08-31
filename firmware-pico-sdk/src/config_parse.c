// Parsowanie + walidacja konfiguracji JSON (jsmn) do struktur runtime.
// Czysty modul (bez sprzetu) - testowalny na hoscie.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "config_store.h"

#define JSMN_STATIC
#include "vendor/jsmn.h"

#define MAX_TOKENS 512

static char err_buf[160];

static const char *KEY_NAMES[] = {"TAB", "ENTER", "ESC", "BACKSPACE", "UP", "DOWN", "LEFT",
                                  "RIGHT", "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
                                  "F9", "F10", "F11", "F12"};

static int is_known_key(const char *k) {
  for (size_t i = 0; i < sizeof(KEY_NAMES) / sizeof(KEY_NAMES[0]); i++)
    if (strcmp(KEY_NAMES[i], k) == 0) return 1;
  return 0;
}

// --- pomocnicze operacje na tokenach jsmn ---
typedef struct {
  const char *js;
  jsmntok_t *t;
  int count;
} jdoc_t;

static int tok_streq(const jdoc_t *d, int i, const char *s) {
  const jsmntok_t *tk = &d->t[i];
  size_t n = (size_t)(tk->end - tk->start);
  return tk->type == JSMN_STRING && strlen(s) == n && strncmp(d->js + tk->start, s, n) == 0;
}

static void tok_copy(const jdoc_t *d, int i, char *out, size_t out_size) {
  const jsmntok_t *tk = &d->t[i];
  size_t n = (size_t)(tk->end - tk->start);
  if (n >= out_size) n = out_size - 1;
  memcpy(out, d->js + tk->start, n);
  out[n] = '\0';
}

static long tok_int(const jdoc_t *d, int i) {
  char buf[24];
  tok_copy(d, i, buf, sizeof(buf));
  return strtol(buf, NULL, 10);
}

static int tok_true(const jdoc_t *d, int i) {
  return d->t[i].type == JSMN_PRIMITIVE && d->js[d->t[i].start] == 't';
}

// przeskocz caly token (z dziecmi); zwraca indeks nastepnego brata
static int tok_skip(const jdoc_t *d, int i) {
  int end = d->t[i].end;
  i++;
  while (i < d->count && d->t[i].start < end) i++;
  return i;
}

// znajdz wartosc klucza w obiekcie o indeksie obj; -1 gdy brak
static int obj_get(const jdoc_t *d, int obj, const char *key) {
  int i = obj + 1;
  int n = d->t[obj].size;
  for (int k = 0; k < n; k++) {
    int val = i + 1;
    if (tok_streq(d, i, key)) return val;
    i = tok_skip(d, val);
  }
  return -1;
}

static const char *bad_pattern(const char *p) {
  if (!p[0]) return "empty pattern";
  if (strchr(p, '{') || strchr(p, '}')) return "{m,n} quantifiers are not supported";
  if (strchr(p, '|')) return "the | alternative is not supported in the C build";
  return NULL;
}

static const char *parse_profile(const jdoc_t *d, int obj, cfg_profile_t *p) {
  memset(p, 0, sizeof(*p));
  int v;

  if ((v = obj_get(d, obj, "name")) < 0) return "profile without a name";
  tok_copy(d, v, p->name, sizeof(p->name));

  p->enabled = (v = obj_get(d, obj, "enabled")) >= 0 && tok_true(d, v);

  int det = obj_get(d, obj, "detect");
  if (det < 0 || (v = obj_get(d, det, "pattern")) < 0) return "profile without detect.pattern";
  tok_copy(d, v, p->detect_pattern, sizeof(p->detect_pattern));
  const char *pe = bad_pattern(p->detect_pattern);
  if (pe) { snprintf(err_buf, sizeof(err_buf), "%s: detect: %s", p->name, pe); return err_buf; }

  int par = obj_get(d, obj, "parse");
  if (par < 0) return "profile without parse";
  char ptype[16] = "";
  if ((v = obj_get(d, par, "type")) >= 0) tok_copy(d, v, ptype, sizeof(ptype));
  if (strcmp(ptype, "gs1") == 0) {
    p->parse_type = PARSE_GS1;
  } else if (strcmp(ptype, "regexGroups") == 0) {
    p->parse_type = PARSE_REGEX_GROUPS;
    if ((v = obj_get(d, par, "pattern")) >= 0) {
      tok_copy(d, v, p->parse_pattern, sizeof(p->parse_pattern));
      pe = bad_pattern(p->parse_pattern);
      if (pe) { snprintf(err_buf, sizeof(err_buf), "%s: parse: %s", p->name, pe); return err_buf; }
    }
    int fields = obj_get(d, par, "fields");
    if (fields < 0 || d->t[fields].type != JSMN_OBJECT || d->t[fields].size == 0)
      return "regexGroups bez mapy fields";
    int fi = fields + 1;
    for (int k = 0; k < d->t[fields].size && p->field_count < CFG_MAX_FIELDS; k++) {
      tok_copy(d, fi, p->fields[p->field_count].name, sizeof(p->fields[0].name));
      p->fields[p->field_count].group = (int)tok_int(d, fi + 1);
      if (p->fields[p->field_count].group < 1) return "group number must be >= 1";
      p->field_count++;
      fi = tok_skip(d, fi + 1);
    }
  } else {
    return "parse.type: dozwolone regexGroups/gs1";
  }

  int out = obj_get(d, obj, "output");
  if (out < 0 || d->t[out].type != JSMN_ARRAY || d->t[out].size == 0) return "profile without output";
  int oi = out + 1;
  for (int k = 0; k < d->t[out].size; k++) {
    if (p->output_count >= CFG_MAX_ACTIONS) return "too many actions in output";
    char atype[8] = "";
    if ((v = obj_get(d, oi, "type")) >= 0) tok_copy(d, v, atype, sizeof(atype));
    cfg_action_t *a = &p->output[p->output_count];
    if (strcmp(atype, "field") == 0) {
      a->type = ACT_FIELD;
      if ((v = obj_get(d, oi, "name")) < 0) return "akcja field bez name";
      tok_copy(d, v, a->value, sizeof(a->value));
    } else if (strcmp(atype, "key") == 0) {
      a->type = ACT_KEY;
      if ((v = obj_get(d, oi, "key")) < 0) return "akcja key bez key";
      tok_copy(d, v, a->value, sizeof(a->value));
      if (!is_known_key(a->value)) {
        snprintf(err_buf, sizeof(err_buf), "%s: unknown key %s", p->name, a->value);
        return err_buf;
      }
    } else if (strcmp(atype, "text") == 0) {
      a->type = ACT_TEXT;
      if ((v = obj_get(d, oi, "value")) >= 0) tok_copy(d, v, a->value, sizeof(a->value));
    } else {
      return "akcja: dozwolone field/key/text";
    }
    p->output_count++;
    oi = tok_skip(d, oi);
  }
  return NULL;
}

void config_defaults(config_t *cfg) {
  memset(cfg, 0, sizeof(*cfg));
  cfg->baudrate = 9600;
  cfg->terminators[0] = 0x0D;
  cfg->terminators[1] = 0x0A;
  cfg->term_count = 2;
  cfg->frame_timeout_ms = 250;
  cfg->duplicate_block_ms = 1500;
  cfg->key_delay_ms = 10;
  cfg->action_delay_ms = 30;
  cfg->out_mode = OUT_PASSTHROUGH;
  cfg->split_at = 4;
  strcpy(cfg->suffix_key, "ENTER");
  cfg->on_error = ONERR_RAW;
  strcpy(cfg->raw_json,
         "{\"version\": 1, \"device\": {\"keyboardLayout\": \"US\", \"keyDelayMs\": 10, "
         "\"actionDelayMs\": 30}, \"scanner\": {\"baudrate\": 9600, \"terminators\": [\"0D\", "
         "\"0A\"], \"frameTimeoutMs\": 250, \"duplicateBlockMs\": 1500}, \"output\": {\"mode\": "
         "\"passthrough\", \"suffixKey\": \"ENTER\", \"prefixText\": \"\", \"suffixText\": \"\", "
         "\"onError\": \"raw\"}, \"profiles\": []}");
}

const char *config_parse(const char *json, size_t len, config_t *cfg) {
  if (len >= CFG_RAW_JSON_MAX) return "configuration too large";

  static jsmntok_t tokens[MAX_TOKENS];
  jsmn_parser parser;
  jsmn_init(&parser);
  int n = jsmn_parse(&parser, json, len, tokens, MAX_TOKENS);
  if (n < 1 || tokens[0].type != JSMN_OBJECT) return "malformed JSON";

  jdoc_t d = {.js = json, .t = tokens, .count = n};
  config_defaults(cfg);
  int v;

  if ((v = obj_get(&d, 0, "version")) < 0 || tok_int(&d, v) != 1)
    return "unsupported configuration version";

  int dev = obj_get(&d, 0, "device");
  if (dev >= 0) {
    if ((v = obj_get(&d, dev, "keyDelayMs")) >= 0) cfg->key_delay_ms = (int)tok_int(&d, v);
    if ((v = obj_get(&d, dev, "actionDelayMs")) >= 0) cfg->action_delay_ms = (int)tok_int(&d, v);
  }
  if (cfg->key_delay_ms < 0 || cfg->key_delay_ms > 500) return "keyDelayMs poza 0-500";
  if (cfg->action_delay_ms < 0 || cfg->action_delay_ms > 1000) return "actionDelayMs poza 0-1000";

  int sc = obj_get(&d, 0, "scanner");
  if (sc >= 0) {
    if ((v = obj_get(&d, sc, "baudrate")) >= 0) cfg->baudrate = (int)tok_int(&d, v);
    if ((v = obj_get(&d, sc, "frameTimeoutMs")) >= 0) cfg->frame_timeout_ms = (int)tok_int(&d, v);
    if ((v = obj_get(&d, sc, "duplicateBlockMs")) >= 0)
      cfg->duplicate_block_ms = (int)tok_int(&d, v);
    int terms = obj_get(&d, sc, "terminators");
    if (terms >= 0 && d.t[terms].type == JSMN_ARRAY) {
      cfg->term_count = 0;
      int ti = terms + 1;
      for (int k = 0; k < d.t[terms].size && cfg->term_count < 4; k++) {
        char hex[8];
        tok_copy(&d, ti, hex, sizeof(hex));
        cfg->terminators[cfg->term_count++] = (uint8_t)strtol(hex, NULL, 16);
        ti = tok_skip(&d, ti);
      }
      if (cfg->term_count == 0) { cfg->terminators[0] = 0x0D; cfg->terminators[1] = 0x0A; cfg->term_count = 2; }
    }
  }
  static const int BAUDS[] = {1200, 4800, 9600, 14400, 19200, 38400, 57600, 115200};
  int baud_ok = 0;
  for (size_t i = 0; i < sizeof(BAUDS) / sizeof(BAUDS[0]); i++)
    if (BAUDS[i] == cfg->baudrate) baud_ok = 1;
  if (!baud_ok) return "baudrate not allowed";
  if (cfg->duplicate_block_ms < 0 || cfg->duplicate_block_ms > 10000) return "duplicateBlockMs poza 0-10000";

  int out = obj_get(&d, 0, "output");
  if (out >= 0) {
    char buf[32];
    if ((v = obj_get(&d, out, "mode")) >= 0) {
      tok_copy(&d, v, buf, sizeof(buf));
      if (strcmp(buf, "split") == 0) cfg->out_mode = OUT_SPLIT;
      else if (strcmp(buf, "passthrough") == 0) cfg->out_mode = OUT_PASSTHROUGH;
      else return "output.mode: passthrough/split";
    }
    if ((v = obj_get(&d, out, "splitAt")) >= 0) cfg->split_at = (int)tok_int(&d, v);
    if ((v = obj_get(&d, out, "suffixKey")) >= 0) {
      tok_copy(&d, v, cfg->suffix_key, sizeof(cfg->suffix_key));
      if (cfg->suffix_key[0] && !is_known_key(cfg->suffix_key)) return "unknown suffixKey";
    }
    if ((v = obj_get(&d, out, "prefixText")) >= 0) tok_copy(&d, v, cfg->prefix_text, sizeof(cfg->prefix_text));
    if ((v = obj_get(&d, out, "suffixText")) >= 0) tok_copy(&d, v, cfg->suffix_text, sizeof(cfg->suffix_text));
    if ((v = obj_get(&d, out, "onError")) >= 0) {
      tok_copy(&d, v, buf, sizeof(buf));
      if (strcmp(buf, "skip") == 0) cfg->on_error = ONERR_SKIP;
      else if (strcmp(buf, "raw") == 0) cfg->on_error = ONERR_RAW;
      else return "onError: raw/skip";
    }
  }

  int profiles = obj_get(&d, 0, "profiles");
  if (profiles >= 0 && d.t[profiles].type == JSMN_ARRAY) {
    int pi = profiles + 1;
    for (int k = 0; k < d.t[profiles].size; k++) {
      if (cfg->profile_count >= CFG_MAX_PROFILES) return "too many profiles (max 6)";
      const char *pe = parse_profile(&d, pi, &cfg->profiles[cfg->profile_count]);
      if (pe) return pe;
      // unikalnosc nazw
      for (int q = 0; q < cfg->profile_count; q++)
        if (strcmp(cfg->profiles[q].name, cfg->profiles[cfg->profile_count].name) == 0)
          return "duplicate profile name";
      cfg->profile_count++;
      pi = tok_skip(&d, pi);
    }
  }

  memcpy(cfg->raw_json, json, len);
  cfg->raw_json[len] = '\0';
  return NULL;
}
