// Testy hostowe modulow czystych (scan_framer, parser_gs1).
// Te same wektory co testy CircuitPythona - kryterium Etapu 11.
// Kompilacja: gcc -I../src test_host.c ../src/scan_framer.c ../src/parser_gs1.c -o test_host
#include <assert.h>
#include <stdio.h>
#include <string.h>

#include "config_store.h"
#include "mini_regex.h"
#include "parser_gs1.h"
#include "profile_matcher.h"
#include "scan_framer.h"

static int tests = 0;
#define CHECK(cond)                                                     \
  do {                                                                  \
    tests++;                                                            \
    if (!(cond)) {                                                      \
      printf("FAIL linia %d: %s\n", __LINE__, #cond);                   \
      return 1;                                                         \
    }                                                                   \
  } while (0)

static int test_framer(void) {
  scan_framer_t f;
  uint8_t terms[] = {0x0D, 0x0A};
  uint8_t out[256];

  // ramka z CR w dwoch kawalkach
  scan_framer_init(&f, terms, 2, 250);
  scan_framer_feed(&f, (const uint8_t *)"P00587", 6, 0);
  CHECK(scan_framer_poll(&f, out, sizeof(out), 10) == 0);
  scan_framer_feed(&f, (const uint8_t *)"46601261\r", 9, 20);
  size_t n = scan_framer_poll(&f, out, sizeof(out), 30);
  CHECK(n == 14 && memcmp(out, "P0058746601261", 14) == 0);

  // dwie ramki CRLF w jednym kawalku
  scan_framer_init(&f, terms, 2, 250);
  scan_framer_feed(&f, (const uint8_t *)"AAA\r\nBBB\r\n", 10, 0);
  n = scan_framer_poll(&f, out, sizeof(out), 1);
  CHECK(n == 3 && memcmp(out, "AAA", 3) == 0);
  n = scan_framer_poll(&f, out, sizeof(out), 2);
  CHECK(n == 3 && memcmp(out, "BBB", 3) == 0);

  // timeout ciszy
  scan_framer_init(&f, terms, 2, 50);
  scan_framer_feed(&f, (const uint8_t *)"XYZ", 3, 100);
  CHECK(scan_framer_poll(&f, out, sizeof(out), 120) == 0);
  n = scan_framer_poll(&f, out, sizeof(out), 160);
  CHECK(n == 3 && memcmp(out, "XYZ", 3) == 0);

  // GS 0x1D przechodzi nietkniety
  scan_framer_init(&f, terms, 2, 250);
  scan_framer_feed(&f, (const uint8_t *)"01123\x1d" "21ABC\r", 12, 0);
  n = scan_framer_poll(&f, out, sizeof(out), 1);
  CHECK(n == 11 && out[5] == 0x1D);

  printf("framer OK\n");
  return 0;
}

static int test_gs1(void) {
  gs1_result_t r;

  // wektor z instrukcji: ]d2 01 05901234567890 17 260831 10 LOT123 GS 21 SER0001
  const uint8_t v1[] = "]d2" "0105901234567890" "17260831" "10LOT123" "\x1d" "21SER0001";
  CHECK(gs1_parse(v1, sizeof(v1) - 1, &r) == GS1_OK);
  CHECK(strcmp(r.aim, "]d2") == 0);
  CHECK(strcmp(r.gtin, "05901234567890") == 0);
  CHECK(strcmp(r.expiry, "260831") == 0);
  CHECK(strcmp(r.expiry_iso, "2026-08-31") == 0);
  CHECK(strcmp(r.lot, "LOT123") == 0);
  CHECK(strcmp(r.serial, "SER0001") == 0);

  // inna kolejnosc, bez AIM
  const uint8_t v2[] = "21SN42" "\x1d" "0105901234123457" "10ABC";
  CHECK(gs1_parse(v2, sizeof(v2) - 1, &r) == GS1_OK);
  CHECK(strcmp(r.serial, "SN42") == 0 && strcmp(r.gtin, "05901234123457") == 0 &&
        strcmp(r.lot, "ABC") == 0);

  // dzien 00 -> ostatni dzien miesiaca (+ luty przestepny)
  char iso[11];
  CHECK(gs1_date_to_iso("260200", iso, sizeof(iso)) == 0 && strcmp(iso, "2026-02-28") == 0);
  CHECK(gs1_date_to_iso("280200", iso, sizeof(iso)) == 0 && strcmp(iso, "2028-02-29") == 0);
  CHECK(gs1_date_to_iso("261100", iso, sizeof(iso)) == 0 && strcmp(iso, "2026-11-30") == 0);

  // bledy
  const uint8_t b1[] = "9912345";
  CHECK(gs1_parse(b1, sizeof(b1) - 1, &r) == GS1_ERR_UNKNOWN_AI);
  const uint8_t b2[] = "010590123412345";
  CHECK(gs1_parse(b2, sizeof(b2) - 1, &r) == GS1_ERR_BAD_FIXED);
  const uint8_t b3[] = "01059012341234AB";
  CHECK(gs1_parse(b3, sizeof(b3) - 1, &r) == GS1_ERR_BAD_FIXED);
  const uint8_t b4[] = "10XXXXXXXXXXXXXXXXXXXXX";  // 21 znakow
  CHECK(gs1_parse(b4, sizeof(b4) - 1, &r) == GS1_ERR_BAD_VARIABLE);

  printf("gs1 OK\n");
  return 0;
}

static int test_regex(void) {
  mr_match_t m;
  char g[64];
  const char *prc = "PRC;JAN;KOWALSKI;12345;IT";

  // detect + parse profilu pracownik-tab (4 grupy)
  CHECK(mr_match("^PRC;", prc, &m) == 1);
  CHECK(mr_match("^PRC;", "EMP;ANNA;NOWAK;1;HR", &m) == 0);
  CHECK(mr_match("^PRC;([^;]+);([^;]+);([^;]+);([^;]+)$", prc, &m) == 1);
  CHECK(m.group_count == 4);
  CHECK(mr_group(&m, 1, prc, g, sizeof(g)) == 0 && strcmp(g, "JAN") == 0);
  CHECK(mr_group(&m, 2, prc, g, sizeof(g)) == 0 && strcmp(g, "KOWALSKI") == 0);
  CHECK(mr_group(&m, 3, prc, g, sizeof(g)) == 0 && strcmp(g, "12345") == 0);
  CHECK(mr_group(&m, 4, prc, g, sizeof(g)) == 0 && strcmp(g, "IT") == 0);
  CHECK(mr_match("^PRC;([^;]+);([^;]+);([^;]+);([^;]+)$", "PRC;JAN;KOWALSKI", &m) == 0);

  // profil demo-prefiks-P: grupy przylegajace
  CHECK(mr_match("^P[0-9]+$", "P0058746601261", &m) == 1);
  CHECK(mr_match("^P[0-9]+$", "P00587X", &m) == 0);
  CHECK(mr_match("^(P[0-9][0-9][0-9])([0-9]+)$", "P0058746601261", &m) == 1);
  CHECK(m.group_count == 2);
  CHECK(mr_group(&m, 1, "P0058746601261", g, sizeof(g)) == 0 && strcmp(g, "P005") == 0);
  CHECK(mr_group(&m, 2, "P0058746601261", g, sizeof(g)) == 0 && strcmp(g, "8746601261") == 0);

  // detect gs1: opcjonalna grupa (\]d2)? - w C-stringu backslash podwojony
  CHECK(mr_match("^(\\]d2)?01[0-9]", "0105901234123457", &m) == 1);
  CHECK(mr_match("^(\\]d2)?01[0-9]", "]d20105901234123457", &m) == 1);
  CHECK(mr_group(&m, 1, "]d20105901234123457", g, sizeof(g)) == 0 && strcmp(g, "]d2") == 0);
  CHECK(mr_match("^(\\]d2)?01[0-9]", "EMP;cos", &m) == 0);

  // klasy, kropka, kwantyfikatory, negacje klas
  CHECK(mr_match("^\\d\\d?-[a-z]+$", "12-abc", &m) == 1);
  CHECK(mr_match("^\\d\\d?-[a-z]+$", "1-x", &m) == 1);
  CHECK(mr_match("^\\d\\d?-[a-z]+$", "abc", &m) == 0);
  CHECK(mr_match("^A.C$", "ABC", &m) == 1);
  CHECK(mr_match("^A.C$", "AC", &m) == 0);
  CHECK(mr_match("^[^;]*$", "bez srednika", &m) == 1);
  CHECK(mr_match("^[^;]*$", "ze;srednikiem", &m) == 0);

  // zachlannosc z backtrackingiem
  CHECK(mr_match("^(.*)B$", "AAABBB", &m) == 1);
  CHECK(mr_group(&m, 1, "AAABBB", g, sizeof(g)) == 0 && strcmp(g, "AAABB") == 0);

  printf("mini_regex OK\n");
  return 0;
}

static int test_config(void) {
  static config_t cfg;
  static char json[8192];

  // realny default_config.json z wersji CircuitPython (to samo zrodlo prawdy)
  FILE *f = fopen("../firmware-circuitpython/default_config.json", "rb");
  if (!f) f = fopen("firmware-circuitpython/default_config.json", "rb");
  CHECK(f != NULL);
  size_t n = fread(json, 1, sizeof(json) - 1, f);
  fclose(f);
  json[n] = '\0';

  const char *err = config_parse(json, n, &cfg);
  if (err) printf("config_parse: %s\n", err);
  CHECK(err == NULL);
  CHECK(cfg.baudrate == 9600 && cfg.term_count == 2 && cfg.terminators[0] == 0x0D);
  CHECK(cfg.frame_timeout_ms == 250 && cfg.duplicate_block_ms == 1500);
  CHECK(cfg.key_delay_ms == 10 && cfg.action_delay_ms == 30);
  CHECK(cfg.out_mode == OUT_PASSTHROUGH && strcmp(cfg.suffix_key, "ENTER") == 0);
  CHECK(cfg.profile_count == 4);  // gs1-datamatrix, pracownik-tab, lek-wtyczka, demo-prefiks-P

  const cfg_profile_t *gs1p = &cfg.profiles[0];
  CHECK(strcmp(gs1p->name, "gs1-datamatrix") == 0 && gs1p->parse_type == PARSE_GS1 && !gs1p->enabled);
  CHECK(gs1p->output_count == 8 && gs1p->output[0].type == ACT_FIELD &&
        strcmp(gs1p->output[0].value, "gtin") == 0);

  const cfg_profile_t *prac = &cfg.profiles[1];
  CHECK(strcmp(prac->name, "pracownik-tab") == 0 && prac->parse_type == PARSE_REGEX_GROUPS);
  CHECK(prac->field_count == 4 && prac->fields[0].group >= 1);
  CHECK(strcmp(prac->detect_pattern, "^PRC;") == 0);

  // przypadki bledne
  const char *bad1 = "{\"version\": 2}";
  CHECK(config_parse(bad1, strlen(bad1), &cfg) != NULL);
  const char *bad2 = "{\"version\": 1, \"scanner\": {\"baudrate\": 1234}}";
  CHECK(config_parse(bad2, strlen(bad2), &cfg) != NULL);
  const char *bad3 =
      "{\"version\": 1, \"profiles\": [{\"name\": \"x\", \"enabled\": true, \"detect\": {\"type\": "
      "\"regex\", \"pattern\": \"^[0-9]{14}$\"}, \"parse\": {\"type\": \"gs1\"}, \"output\": "
      "[{\"type\": \"key\", \"key\": \"ENTER\"}]}]}";
  err = config_parse(bad3, strlen(bad3), &cfg);
  CHECK(err != NULL && strstr(err, "{m,n}") != NULL);
  const char *bad4 =
      "{\"version\": 1, \"profiles\": [{\"name\": \"x\", \"detect\": {\"pattern\": \"^A\"}, "
      "\"parse\": {\"type\": \"gs1\"}, \"output\": [{\"type\": \"key\", \"key\": \"SUPER\"}]}]}";
  err = config_parse(bad4, strlen(bad4), &cfg);
  CHECK(err != NULL && strstr(err, "nieznany klawisz") != NULL);

  printf("config_parse OK\n");
  return 0;
}

static config_t g_cfg;  // duza struktura - poza stosem

static int test_matcher(void) {
  static char json[8192];
  FILE *f = fopen("../firmware-circuitpython/default_config.json", "rb");
  if (!f) f = fopen("firmware-circuitpython/default_config.json", "rb");
  CHECK(f != NULL);
  size_t n = fread(json, 1, sizeof(json) - 1, f);
  fclose(f);
  json[n] = '\0';
  CHECK(config_parse(json, n, &g_cfg) == NULL);
  g_cfg.profiles[0].enabled = 1;  // gs1-datamatrix
  g_cfg.profiles[1].enabled = 1;  // pracownik-tab

  pm_actions_t acts;

  // profil pracownik-tab: JAN TAB KOWALSKI TAB 12345 TAB IT ENTER
  const uint8_t prc[] = "PRC;JAN;KOWALSKI;12345;IT";
  CHECK(pm_build_actions(&g_cfg, prc, sizeof(prc) - 1, &acts) == PM_MATCHED);
  CHECK(acts.count == 8);
  CHECK(acts.items[0].type == ACT_TEXT && strcmp(acts.items[0].value, "JAN") == 0);
  CHECK(acts.items[1].type == ACT_KEY && strcmp(acts.items[1].value, "TAB") == 0);
  CHECK(strcmp(acts.items[6].value, "IT") == 0 && strcmp(acts.items[7].value, "ENTER") == 0);

  // profil gs1: gtin TAB dataISO TAB partia TAB serial ENTER
  const uint8_t gs1[] = "0105901234123457" "17270630" "10P77" "\x1d" "21S001";
  CHECK(pm_build_actions(&g_cfg, gs1, sizeof(gs1) - 1, &acts) == PM_MATCHED);
  CHECK(acts.count == 8);
  CHECK(strcmp(acts.items[0].value, "05901234123457") == 0);
  CHECK(strcmp(acts.items[2].value, "2027-06-30") == 0);
  CHECK(strcmp(acts.items[4].value, "P77") == 0 && strcmp(acts.items[6].value, "S001") == 0);

  // EAN bez profilu -> passthrough + ENTER
  const uint8_t ean[] = "8592601121847";
  CHECK(pm_build_actions(&g_cfg, ean, sizeof(ean) - 1, &acts) == PM_FALLBACK);
  CHECK(acts.count == 2 && strcmp(acts.items[0].value, "8592601121847") == 0 &&
        strcmp(acts.items[1].value, "ENTER") == 0);

  // onError: detect gs1 pasuje, parse pada
  const uint8_t bad[] = "0105901234123457" "99XX";
  g_cfg.on_error = ONERR_RAW;
  CHECK(pm_build_actions(&g_cfg, bad, sizeof(bad) - 1, &acts) == PM_FALLBACK);
  CHECK(strcmp(acts.items[0].value, "010590123412345799XX") == 0);
  g_cfg.on_error = ONERR_SKIP;
  CHECK(pm_build_actions(&g_cfg, bad, sizeof(bad) - 1, &acts) == PM_SKIPPED);
  g_cfg.on_error = ONERR_RAW;

  // nie-ASCII odrzucone
  const uint8_t junk[] = {0xFF, 0xFE};
  CHECK(pm_build_actions(&g_cfg, junk, 2, &acts) == PM_EMPTY);

  // split fallback
  g_cfg.out_mode = OUT_SPLIT;
  g_cfg.split_at = 4;
  const uint8_t abc[] = "ABCD1234";
  CHECK(pm_build_actions(&g_cfg, abc, sizeof(abc) - 1, &acts) == PM_FALLBACK);
  CHECK(acts.count == 4 && strcmp(acts.items[0].value, "ABCD") == 0 &&
        strcmp(acts.items[1].value, "TAB") == 0 && strcmp(acts.items[2].value, "1234") == 0);

  printf("profile_matcher OK\n");
  return 0;
}

int main(void) {
  if (test_framer()) return 1;
  if (test_gs1()) return 1;
  if (test_regex()) return 1;
  if (test_config()) return 1;
  if (test_matcher()) return 1;
  printf("WSZYSTKIE TESTY C PRZESZLY (%d asercji)\n", tests);
  return 0;
}
