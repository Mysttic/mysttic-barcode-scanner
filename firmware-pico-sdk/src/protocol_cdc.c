// Kanal konfiguracyjny CDC - protokol NDJSON (szkielet Etapu 11).
// Na razie: ping / hidTest (dowod dzialania warstw CDC+HID).
// Pelny port komend (getConfig/setConfig/...) w kolejnych iteracjach.
#include "protocol_cdc.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "output_hid.h"
#include "tusb.h"

#define LINE_MAX 1024
static char line_buf[LINE_MAX];
static size_t line_len = 0;

// Minimalny ekstraktor: "cmd" (string) i "requestId" (liczba calkowita).
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

static void send_line(const char *json) {
  tud_cdc_write_str(json);
  tud_cdc_write_str("\n");
  tud_cdc_write_flush();
}

static void handle_line(const char *line) {
  char cmd[32];
  long request_id = -1;
  extract_int(line, "requestId", &request_id);
  if (extract_string(line, "cmd", cmd, sizeof(cmd)) != 0) {
    send_line("{\"ok\": false, \"error\": \"bledny JSON lub brak cmd\"}");
    return;
  }

  char resp[192];
  if (strcmp(cmd, "ping") == 0) {
    snprintf(resp, sizeof(resp),
             "{\"ok\": true, \"pong\": true, \"fw\": \"%s\", \"impl\": \"c\", \"requestId\": %ld}",
             FIRMWARE_VERSION_C, request_id);
    send_line(resp);
  } else if (strcmp(cmd, "hidTest") == 0) {
    output_hid_queue_text("barcode-reader C firmware test 123");
    output_hid_queue_key(0x28 /* HID_KEY_ENTER */);
    snprintf(resp, sizeof(resp), "{\"ok\": true, \"queued\": true, \"requestId\": %ld}", request_id);
    send_line(resp);
  } else {
    snprintf(resp, sizeof(resp),
             "{\"ok\": false, \"error\": \"nieznana komenda (szkielet C): %s\", \"requestId\": %ld}",
             cmd, request_id);
    send_line(resp);
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
      line_len = 0;  // przepelnienie linii - odrzuc
      send_line("{\"ok\": false, \"error\": \"wiadomosc za dluga\"}");
    }
  }
}
