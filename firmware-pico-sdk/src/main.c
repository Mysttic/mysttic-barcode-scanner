// Etap 11 - szkielet firmware C: urzadzenie kompozytowe CDC+HID na TinyUSB.
// Petla glowna bez blokowania: tud_task + protokol CDC + kolejka HID + LED.
#include "bsp/board_api.h"
#include "pico/stdlib.h"
#include "tusb.h"

#include "output_hid.h"
#include "protocol_cdc.h"

int main(void) {
  board_init();
  tusb_init();
  if (board_init_after_tusb) board_init_after_tusb();

  uint32_t led_ms = 0;
  bool led_on = false;

  while (true) {
    tud_task();
    protocol_cdc_task();
    output_hid_task();

    // wolne mruganie = firmware zyje
    uint32_t now = board_millis();
    if (now - led_ms > 500) {
      led_ms = now;
      led_on = !led_on;
      board_led_write(led_on);
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
