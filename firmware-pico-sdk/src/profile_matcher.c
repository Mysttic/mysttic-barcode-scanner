// Dopasowanie profili i budowa listy akcji (port profiles.py + parser.py na C).
// Czysty modul - testowalny na hoscie.
#include "profile_matcher.h"

#include <stdio.h>
#include <string.h>

#include "mini_regex.h"
#include "parser_gs1.h"

// tekst po filtrze ASCII-drukowalnych (jak _decode_ascii w CP)
static int printable_text(const uint8_t *raw, size_t len, char *out, size_t out_size) {
  size_t n = 0;
  for (size_t i = 0; i < len; i++) {
    if (raw[i] > 127) return -1;  // nie-ASCII: odrzuc caly skan
    if (raw[i] >= 32 && raw[i] < 127) {
      if (n + 1 >= out_size) return -1;
      out[n++] = (char)raw[i];
    }
  }
  out[n] = '\0';
  return (int)n;
}

static int emit(pm_actions_t *acts, action_type_t type, const char *value) {
  if (acts->count >= PM_MAX_ACTIONS) return -1;
  acts->items[acts->count].type = type;
  snprintf(acts->items[acts->count].value, sizeof(acts->items[0].value), "%s", value);
  acts->count++;
  return 0;
}

static const char *gs1_field(const gs1_result_t *r, const char *name) {
  if (strcmp(name, "gtin") == 0) return r->gtin;
  if (strcmp(name, "expiry") == 0) return r->expiry;
  if (strcmp(name, "expiryISO") == 0) return r->expiry_iso;
  if (strcmp(name, "batch") == 0) return r->lot;
  if (strcmp(name, "serial") == 0) return r->serial;
  if (strcmp(name, "aim") == 0) return r->aim;
  return NULL;
}

static int try_profile(const cfg_profile_t *p, const char *text, const uint8_t *raw, size_t raw_len,
                       pm_actions_t *acts) {
  mr_match_t dm;
  if (!mr_match(p->detect_pattern, text, &dm)) return PM_NO_MATCH;

  if (p->parse_type == PARSE_GS1) {
    gs1_result_t r;
    if (gs1_parse(raw, raw_len, &r) != GS1_OK) return PM_PARSE_ERROR;
    for (int i = 0; i < p->output_count; i++) {
      const cfg_action_t *a = &p->output[i];
      if (a->type == ACT_FIELD) {
        const char *v = gs1_field(&r, a->value);
        if (v && v[0]) emit(acts, ACT_TEXT, v);
      } else {
        emit(acts, a->type, a->value);
      }
    }
    return acts->count ? PM_MATCHED : PM_PARSE_ERROR;
  }

  // regexGroups
  const char *pattern = p->parse_pattern[0] ? p->parse_pattern : p->detect_pattern;
  mr_match_t pm;
  if (!mr_match(pattern, text, &pm)) return PM_PARSE_ERROR;
  for (int i = 0; i < p->output_count; i++) {
    const cfg_action_t *a = &p->output[i];
    if (a->type == ACT_FIELD) {
      int group = -1;
      for (int f = 0; f < p->field_count; f++)
        if (strcmp(p->fields[f].name, a->value) == 0) group = p->fields[f].group;
      char val[128];
      if (group < 1 || mr_group(&pm, group, text, val, sizeof(val)) != 0) return PM_PARSE_ERROR;
      if (val[0]) emit(acts, ACT_TEXT, val);
    } else {
      emit(acts, a->type, a->value);
    }
  }
  return acts->count ? PM_MATCHED : PM_PARSE_ERROR;
}

int pm_build_actions(const config_t *cfg, const uint8_t *raw, size_t raw_len, pm_actions_t *acts) {
  memset(acts, 0, sizeof(*acts));

  char text[300];
  if (printable_text(raw, raw_len, text, sizeof(text)) <= 0) return PM_EMPTY;

  int had_parse_error = 0;
  for (int i = 0; i < cfg->profile_count; i++) {
    const cfg_profile_t *p = &cfg->profiles[i];
    if (!p->enabled) continue;
    pm_actions_t tmp = {0};
    int r = try_profile(p, text, raw, raw_len, &tmp);
    if (r == PM_MATCHED) {
      *acts = tmp;
      return PM_MATCHED;
    }
    if (r == PM_PARSE_ERROR) had_parse_error = 1;
  }

  if (had_parse_error && cfg->on_error == ONERR_SKIP) return PM_SKIPPED;

  // fallback: passthrough / split (+ prefiks/sufiks)
  if (cfg->prefix_text[0]) emit(acts, ACT_TEXT, cfg->prefix_text);
  size_t tlen = strlen(text);
  if (cfg->out_mode == OUT_SPLIT && cfg->split_at > 0 && (size_t)cfg->split_at < tlen) {
    char part[300];
    memcpy(part, text, (size_t)cfg->split_at);
    part[cfg->split_at] = '\0';
    emit(acts, ACT_TEXT, part);
    emit(acts, ACT_KEY, "TAB");
    emit(acts, ACT_TEXT, text + cfg->split_at);
  } else {
    emit(acts, ACT_TEXT, text);
  }
  if (cfg->suffix_text[0]) emit(acts, ACT_TEXT, cfg->suffix_text);
  if (cfg->suffix_key[0]) emit(acts, ACT_KEY, cfg->suffix_key);
  return PM_FALLBACK;
}
