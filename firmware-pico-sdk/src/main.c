// Etap 11 faza 2: pelny pipeline w C.
// UART skanera -> scan_framer -> profile_matcher -> HID / event testowy (CDC).
// Watchdog, blokada duplikatow, LED statusu (GP6), konfiguracja z flasha A/B.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "bsp/board_api.h"
#include "hardware/gpio.h"
#include "hardware/uart.h"
#include "hardware/watchdog.h"
#include "pico/bootrom.h"
#include "pico/stdlib.h"
#include "tusb.h"

#include "app_state.h"
#include "output_hid.h"
#include "parser_gs1.h"
#include "profile_matcher.h"
#include "protocol_cdc.h"
#include "scan_framer.h"

#define SCANNER_UART uart0
#define PIN_TX 0
#define PIN_RX 1
#define PIN_LED 6

app_state_t app_state;

static scan_framer_t framer;
static uint8_t last_frame[SCAN_FRAMER_BUF_SIZE];
static size_t last_frame_len = 0;
static uint32_t last_frame_ms = 0;

static void scanner_apply_config(void) {
  uart_init(SCANNER_UART, (uint32_t)app_state.cfg.baudrate);
  gpio_set_function(PIN_TX, GPIO_FUNC_UART);
  gpio_set_function(PIN_RX, GPIO_FUNC_UART);
  uart_set_format(SCANNER_UART, 8, 1, UART_PARITY_NONE);
  uart_set_fifo_enabled(SCANNER_UART, true);
  scan_framer_init(&framer, app_state.cfg.terminators, (size_t)app_state.cfg.term_count,
                   (uint32_t)app_state.cfg.frame_timeout_ms);
  output_hid_set_delays(app_state.cfg.key_delay_ms, app_state.cfg.action_delay_ms);
}

static void scanner_uart_task(void) {
  uint8_t chunk[64];
  size_t n = 0;
  while (n < sizeof(chunk) && uart_is_readable(SCANNER_UART)) chunk[n++] = uart_getc(SCANNER_UART);
  if (n) scan_framer_feed(&framer, chunk, n, board_millis());
}

// base64 (na potrzeby eventow trybu testowego)
static void b64_encode(const uint8_t *in, size_t len, char *out, size_t out_size) {
  static const char T[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  size_t o = 0;
  for (size_t i = 0; i < len && o + 5 < out_size; i += 3) {
    uint32_t v = (uint32_t)in[i] << 16;
    if (i + 1 < len) v |= (uint32_t)in[i + 1] << 8;
    if (i + 2 < len) v |= in[i + 2];
    out[o++] = T[(v >> 18) & 63];
    out[o++] = T[(v >> 12) & 63];
    out[o++] = (i + 1 < len) ? T[(v >> 6) & 63] : '=';
    out[o++] = (i + 2 < len) ? T[v & 63] : '=';
  }
  out[o] = '\0';
}

static uint8_t key_name_to_hid(const char *name) {
  if (strcmp(name, "TAB") == 0) return 0x2B;
  if (strcmp(name, "ENTER") == 0) return 0x28;
  if (strcmp(name, "ESC") == 0) return 0x29;
  if (strcmp(name, "BACKSPACE") == 0) return 0x2A;
  if (strcmp(name, "UP") == 0) return 0x52;
  if (strcmp(name, "DOWN") == 0) return 0x51;
  if (strcmp(name, "LEFT") == 0) return 0x50;
  if (strcmp(name, "RIGHT") == 0) return 0x4F;
  if (name[0] == 'F') {
    int n = atoi(name + 1);
    if (n >= 1 && n <= 12) return (uint8_t)(0x3A + n - 1);
  }
  return 0;
}

static void send_test_event(const uint8_t *raw, size_t len) {
  static char b64[400], hex[600], resp[1200];
  b64_encode(raw, len, b64, sizeof(b64));
  size_t ho = 0;
  for (size_t i = 0; i < len && ho + 3 < sizeof(hex); i++)
    ho += (size_t)snprintf(hex + ho, sizeof(hex) - ho, "%02x", raw[i]);

  // dopasuj profil informacyjnie (bez wysylania HID)
  pm_actions_t acts;
  int r = pm_build_actions(&app_state.cfg, raw, len, &acts);
  const char *profile = "null";
  char pbuf[40];
  if (r == PM_MATCHED) {
    // znajdz nazwe pierwszego wlaczonego pasujacego profilu — pm nie zwraca nazwy,
    // wiec raportujemy sam fakt dopasowania
    snprintf(pbuf, sizeof(pbuf), "\"(dopasowany)\"");
    profile = pbuf;
  }
  snprintf(resp, sizeof(resp),
           "{\"event\": \"scan\", \"rawBase64\": \"%s\", \"hex\": \"%s\", \"profile\": %s, \"fields\": {}}",
           b64, hex, profile);
  cdc_send_line(resp);
}

static void run_actions(const pm_actions_t *acts) {
  for (int i = 0; i < acts->count; i++) {
    const cfg_action_t *a = &acts->items[i];
    if (a->type == ACT_KEY) {
      uint8_t k = key_name_to_hid(a->value);
      if (k) output_hid_queue_key(k);
    } else {
      output_hid_queue_text(a->value);
    }
  }
}

static void process_frame(const uint8_t *frame, size_t len) {
  uint32_t now = board_millis();
  int block = app_state.cfg.duplicate_block_ms;
  if (block > 0 && len == last_frame_len && memcmp(frame, last_frame, len) == 0 &&
      (now - last_frame_ms) < (uint32_t)block) {
    last_frame_ms = now;  // kod wciaz przed okiem - odswiez okno blokady
    return;
  }
  memcpy(last_frame, frame, len);
  last_frame_len = len;
  last_frame_ms = now;

  if (app_state.test_mode) {
    send_test_event(frame, len);
    gpio_xor_mask(1u << PIN_LED);
    return;
  }
  pm_actions_t acts;
  int r = pm_build_actions(&app_state.cfg, frame, len, &acts);
  if (r == PM_MATCHED || r == PM_FALLBACK) {
    run_actions(&acts);
    gpio_xor_mask(1u << PIN_LED);
  }
}

int main(void) {
  board_init();

  // factory reset: GP2 (przycisk do GND) wcisniety przy starcie ~1 s
  gpio_init(2);
  gpio_set_dir(2, GPIO_IN);
  gpio_pull_up(2);
  sleep_ms(50);
  bool skip_config = false;
  if (!gpio_get(2)) {
    sleep_ms(1000);
    skip_config = !gpio_get(2);
  }

  gpio_init(PIN_LED);
  gpio_set_dir(PIN_LED, GPIO_OUT);

  if (skip_config || !config_flash_load(&app_state.cfg)) config_defaults(&app_state.cfg);
  if (skip_config) config_flash_erase();

  tusb_init();
  if (board_init_after_tusb) board_init_after_tusb();
  scanner_apply_config();

  watchdog_enable(3000, 1);

  uint8_t frame[SCAN_FRAMER_BUF_SIZE];
  while (true) {
    watchdog_update();
    tud_task();
    protocol_cdc_task();
    output_hid_task();
    scanner_uart_task();

    size_t n = scan_framer_poll(&framer, frame, sizeof(frame), board_millis());
    if (n) process_frame(frame, n);

    if (app_state.config_dirty) {
      app_state.config_dirty = false;
      scanner_apply_config();
    }
    if (app_state.pending_reset != RESET_NONE && output_hid_idle()) {
      sleep_ms(100);  // niech odpowiedz CDC wyjdzie
      if (app_state.pending_reset == RESET_BOOTLOADER) reset_usb_boot(0, 0);
      watchdog_reboot(0, 0, 0);
      while (true) tight_loop_contents();
    }
  }
}

// --- wymagane callbacki TinyUSB HID ---
uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t report_type,
                               uint8_t *buffer, uint16_t reqlen) {
  (void)instance; (void)report_id; (void)report_type; (void)buffer; (void)reqlen;
  return 0;
}

void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t report_type,
                           const uint8_t *buffer, uint16_t bufsize) {
  (void)instance; (void)report_id; (void)report_type; (void)buffer; (void)bufsize;
}
