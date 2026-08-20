#ifndef SCAN_FRAMER_H_
#define SCAN_FRAMER_H_

#include <stddef.h>
#include <stdint.h>

#define SCAN_FRAMER_BUF_SIZE 256
#define SCAN_FRAMER_MAX_TERMS 4

typedef struct {
  uint8_t buf[SCAN_FRAMER_BUF_SIZE];
  size_t len;
  uint8_t terminators[SCAN_FRAMER_MAX_TERMS];
  size_t term_count;
  uint32_t frame_timeout_ms;
  uint32_t last_rx_ms;
} scan_framer_t;

void scan_framer_init(scan_framer_t *f, const uint8_t *terminators, size_t term_count,
                      uint32_t frame_timeout_ms);
void scan_framer_feed(scan_framer_t *f, const uint8_t *data, size_t len, uint32_t now_ms);
// Zwraca dlugosc ramki skopiowanej do out (0 = brak pelnej ramki).
size_t scan_framer_poll(scan_framer_t *f, uint8_t *out, size_t out_size, uint32_t now_ms);

#endif
