// Testy hostowe modulow czystych (scan_framer, parser_gs1).
// Te same wektory co testy CircuitPythona - kryterium Etapu 11.
// Kompilacja: gcc -I../src test_host.c ../src/scan_framer.c ../src/parser_gs1.c -o test_host
#include <assert.h>
#include <stdio.h>
#include <string.h>

#include "parser_gs1.h"
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

int main(void) {
  if (test_framer()) return 1;
  if (test_gs1()) return 1;
  printf("WSZYSTKIE TESTY C PRZESZLY (%d asercji)\n", tests);
  return 0;
}
