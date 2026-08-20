#ifndef PARSER_GS1_H_
#define PARSER_GS1_H_

#include <stddef.h>
#include <stdint.h>

enum {
  GS1_OK = 0,
  GS1_ERR_TRUNCATED = -1,
  GS1_ERR_BAD_FIXED = -2,
  GS1_ERR_BAD_VARIABLE = -3,
  GS1_ERR_UNKNOWN_AI = -4,
  GS1_ERR_EMPTY = -5,
  GS1_ERR_TOO_LONG = -6,
};

typedef struct {
  char aim[4];         // np. "]d2" albo pusty
  char gtin[15];       // AI 01
  char expiry[7];      // AI 17 (YYMMDD)
  char expiry_iso[11]; // YYYY-MM-DD (dzien 00 = ostatni dzien miesiaca)
  char lot[21];        // AI 10
  char serial[21];     // AI 21
} gs1_result_t;

int gs1_parse(const uint8_t *raw, size_t len, gs1_result_t *result);
int gs1_date_to_iso(const char *yymmdd, char *out, size_t out_size);

#endif
