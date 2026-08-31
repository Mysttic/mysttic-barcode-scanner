// Kanal konfiguracyjny CDC - protokol NDJSON, pelny zestaw komend (Etap 11):
// ping / getConfig / setConfig / save / setMode / factoryReset / reboot /
// rebootBootloader (+ hidTest diagnostycznie). Eventy trybu testowego wysyla main.
#include "protocol_cdc.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "app_state.h"
#include "output_hid.h"
#include "tusb.h"

#define LINE_MAX 6144
static char line_buf[LINE_MAX];
static size_t line_len = 0;

static int extract_string(const char *json, const char *key, char *out, size_t out_size) {
  char pattern[32];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char *p = strstr(json, pattern);
  if (!p) return -1;
  p = strchr(p + strlen(pattern), ':');
  if (!p) return -1;
  p++;
  while (*p == ' ') p++;
  if (*p != '"') return -1;
  p++;
  size_t i = 0;
  while (*p && *p != '"' && i + 1 < out_size) out[i++] = *p++;
  out[i] = '\0';
  return (*p == '"') ? 0 : -1;
}

static int extract_int(const char *json, const char *key, long *out) {
  char pattern[32];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char *p = strstr(json, pattern);
  if (!p) return -1;
  p = strchr(p + strlen(pattern), ':');
  if (!p) return -1;
  p++;
  while (*p == ' ') p++;
  char *end;
  long v = strtol(p, &end, 10);
  if (end == p) return -1;
  *out = v;
  return 0;
}

// wyciaga SUROWY podlancuch JSON wartosci klucza "config" (obiekt {...})
static int extract_object(const char *json, const char *key, const char **start, size_t *len) {
  char pattern[32];
  snprintf(pattern, sizeof(pattern), "\"%s\"", key);
  const char *p = strstr(json, pattern);
  if (!p) return -1;
  p = strchr(p + strlen(pattern), ':');
  if (!p) return -1;
  p++;
  while (*p == ' ') p++;
  if (*p != '{') return -1;
  int depth = 0;
  const char *q = p;
  int in_str = 0;
  while (*q) {
    char ch = *q;
    if (in_str) {
      if (ch == '\\' && q[1]) q++;
      else if (ch == '"') in_str = 0;
    } else {
      if (ch == '"') in_str = 1;
      else if (ch == '{') depth++;
      else if (ch == '}') {
        depth--;
        if (depth == 0) {
          *start = p;
          *len = (size_t)(q - p + 1);
          return 0;
        }
      }
    }
    q++;
  }
  return -1;
}

void cdc_send_line(const char *json) {
  size_t len = strlen(json);
  size_t off = 0;
  while (off < len) {
    uint32_t n = tud_cdc_write(json + off, (uint32_t)(len - off));
    off += n;
    tud_cdc_write_flush();
    if (n == 0) tud_task();  // czekaj na miejsce w FIFO
  }
  tud_cdc_write_str("\n");
  tud_cdc_write_flush();
}

static void reply_simple(long rid, const char *body_ok_true) {
  char resp[192];
  snprintf(resp, sizeof(resp), "{\"ok\": true, %s, \"requestId\": %ld}", body_ok_true, rid);
  cdc_send_line(resp);
}

static void reply_error(long rid, const char *error) {
  char resp[256];
  snprintf(resp, sizeof(resp), "{\"ok\": false, \"error\": \"%s\", \"requestId\": %ld}", error, rid);
  cdc_send_line(resp);
}

static void handle_line(const char *line) {
  char cmd[32];
  long rid = -1;
  extract_int(line, "requestId", &rid);
  if (extract_string(line, "cmd", cmd, sizeof(cmd)) != 0) {
    reply_error(rid, "malformed JSON or no cmd");
    return;
  }

  if (strcmp(cmd, "ping") == 0) {
    char body[96];
    snprintf(body, sizeof(body), "\"pong\": true, \"fw\": \"%s\", \"impl\": \"c\", \"mode\": \"%s\", \"version\": 1",
             FIRMWARE_VERSION_C, app_state.test_mode ? "test" : "hid");
    reply_simple(rid, body);
  } else if (strcmp(cmd, "getConfig") == 0) {
    static char resp[CFG_RAW_JSON_MAX + 96];
    snprintf(resp, sizeof(resp), "{\"ok\": true, \"config\": %s, \"requestId\": %ld}",
             app_state.cfg.raw_json, rid);
    cdc_send_line(resp);
  } else if (strcmp(cmd, "setConfig") == 0) {
    const char *cj;
    size_t cl;
    if (extract_object(line, "config", &cj, &cl) != 0) {
      reply_error(rid, "no config field");
      return;
    }
    static config_t candidate;  // duza - statycznie
    const char *err = config_parse(cj, cl, &candidate);
    if (err) {
      reply_error(rid, err);
      return;
    }
    app_state.cfg = candidate;
    app_state.config_dirty = true;  // main przeladuje UART/framer
    reply_simple(rid, "\"applied\": true, \"persisted\": false");
  } else if (strcmp(cmd, "save") == 0) {
    const char *err = config_flash_save(&app_state.cfg);
    if (err) reply_error(rid, err);
    else reply_simple(rid, "\"persisted\": true");
  } else if (strcmp(cmd, "setMode") == 0) {
    char mode[12];
    if (extract_string(line, "mode", mode, sizeof(mode)) != 0 ||
        (strcmp(mode, "hid") != 0 && strcmp(mode, "test") != 0)) {
      reply_error(rid, "mode: hid or test");
      return;
    }
    app_state.test_mode = (strcmp(mode, "test") == 0);
    char body[48];
    snprintf(body, sizeof(body), "\"mode\": \"%s\"", mode);
    reply_simple(rid, body);
  } else if (strcmp(cmd, "factoryReset") == 0) {
    config_flash_erase();
    config_defaults(&app_state.cfg);
    app_state.config_dirty = true;
    reply_simple(rid, "\"applied\": true, \"nvmCleared\": true");
  } else if (strcmp(cmd, "reboot") == 0) {
    reply_simple(rid, "\"rebooting\": true");
    app_state.pending_reset = RESET_NORMAL;
  } else if (strcmp(cmd, "rebootBootloader") == 0) {
    reply_simple(rid, "\"rebooting\": true");
    app_state.pending_reset = RESET_BOOTLOADER;
  } else if (strcmp(cmd, "hidTest") == 0) {
    output_hid_queue_text("Mysttic Barcode Scanner test 123");
    output_hid_queue_key(0x28 /* HID_KEY_ENTER */);
    reply_simple(rid, "\"queued\": true");
  } else {
    char err[64];
    snprintf(err, sizeof(err), "unknown command: %.32s", cmd);
    reply_error(rid, err);
  }
}

void protocol_cdc_task(void) {
  while (tud_cdc_available()) {
    uint8_t ch;
    if (tud_cdc_read(&ch, 1) != 1) break;
    if (ch == '\n') {
      line_buf[line_len] = '\0';
      if (line_len > 0) handle_line(line_buf);
      line_len = 0;
    } else if (line_len + 1 < LINE_MAX) {
      line_buf[line_len++] = (char)ch;
    } else {
      line_len = 0;
      cdc_send_line("{\"ok\": false, \"error\": \"message too long\"}");
    }
  }
}
