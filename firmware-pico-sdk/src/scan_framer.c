// Ramkowanie strumienia ze skanera (port scanner_uart.py na C).
// Czysty modul bez zaleznosci sprzetowych - testowalny na hoscie.
#include "scan_framer.h"

#include <string.h>

void scan_framer_init(scan_framer_t *f, const uint8_t *terminators, size_t term_count,
                      uint32_t frame_timeout_ms) {
  memset(f, 0, sizeof(*f));
  if (term_count > SCAN_FRAMER_MAX_TERMS) term_count = SCAN_FRAMER_MAX_TERMS;
  memcpy(f->terminators, terminators, term_count);
  f->term_count = term_count;
  f->frame_timeout_ms = frame_timeout_ms;
}

static int is_terminator(const scan_framer_t *f, uint8_t b) {
  for (size_t i = 0; i < f->term_count; i++)
    if (f->terminators[i] == b) return 1;
  return 0;
}

void scan_framer_feed(scan_framer_t *f, const uint8_t *data, size_t len, uint32_t now_ms) {
  for (size_t i = 0; i < len; i++) {
    if (f->len < SCAN_FRAMER_BUF_SIZE) f->buf[f->len++] = data[i];
    // przepelnienie: nadmiar obcinamy (kod dluzszy niz bufor = odrzucany przy poll)
  }
  if (len) f->last_rx_ms = now_ms;
}

size_t scan_framer_poll(scan_framer_t *f, uint8_t *out, size_t out_size, uint32_t now_ms) {
  // szukaj pierwszego terminatora
  for (size_t i = 0; i < f->len; i++) {
    if (is_terminator(f, f->buf[i])) {
      size_t frame_len = i;
      size_t copy = frame_len < out_size ? frame_len : out_size;
      memcpy(out, f->buf, copy);
      // usun ramke + terminator z bufora
      memmove(f->buf, f->buf + i + 1, f->len - i - 1);
      f->len -= i + 1;
      if (frame_len == 0) return scan_framer_poll(f, out, out_size, now_ms);  // pusty CRLF
      return copy;
    }
  }
  // timeout ciszy domyka ramke bez terminatora
  if (f->len > 0 && f->frame_timeout_ms > 0 && (now_ms - f->last_rx_ms) > f->frame_timeout_ms) {
    size_t copy = f->len < out_size ? f->len : out_size;
    memcpy(out, f->buf, copy);
    f->len = 0;
    return copy;
  }
  return 0;
}
