// Atrapa skanera GM65 do symulacji Wokwi.
// Co 3 s wysyla po UART (9600 8N1) przykladowy kod EAN-13 zakonczony CR LF.
#include "wokwi-api.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
  uart_dev_t uart;
  uint32_t counter;
} chip_state_t;

static const char *CODES[] = {
  "5901234123457",
  "4006381333931",
  "9788372780751",
};

static void on_timer(void *user_data) {
  chip_state_t *chip = (chip_state_t *)user_data;
  const char *code = CODES[chip->counter % 3];
  chip->counter++;
  char frame[64];
  int len = snprintf(frame, sizeof(frame), "%s\r\n", code);
  uart_write(chip->uart, (uint8_t *)frame, len);
  printf("GM65 -> TX: %s\n", code);
}

static void on_uart_rx(void *user_data, uint8_t byte) {
  // GM65 przyjmuje komendy konfiguracyjne - atrapa je ignoruje.
  (void)user_data;
  (void)byte;
}

void chip_init(void) {
  chip_state_t *chip = malloc(sizeof(chip_state_t));
  chip->counter = 0;

  const uart_config_t uart_config = {
    .tx = pin_init("TX", INPUT),
    .rx = pin_init("RX", INPUT),
    .baud_rate = 9600,
    .rx_data = on_uart_rx,
    .user_data = chip,
  };
  chip->uart = uart_init(&uart_config);

  const timer_config_t timer_config = {
    .callback = on_timer,
    .user_data = chip,
  };
  timer_t timer = timer_init(&timer_config);
  timer_start(timer, 3000000, true);

  printf("GM65 dummy gotowy - wysylam kod co 3 s\n");
}
