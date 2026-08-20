// Parser GS1 (port parser_gs1.py na C). Czysty modul - testowalny na hoscie.
#include "parser_gs1.h"

#include <string.h>

#define GS 0x1D

static const uint8_t days_in_month[12] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};

static int is_digits(const uint8_t *p, size_t n) {
  for (size_t i = 0; i < n; i++)
    if (p[i] < '0' || p[i] > '9') return 0;
  return 1;
}

int gs1_date_to_iso(const char *yymmdd, char *out, size_t out_size) {
  if (strlen(yymmdd) != 6 || out_size < 11) return -1;
  int yy = (yymmdd[0] - '0') * 10 + (yymmdd[1] - '0');
  int mm = (yymmdd[2] - '0') * 10 + (yymmdd[3] - '0');
  int dd = (yymmdd[4] - '0') * 10 + (yymmdd[5] - '0');
  int year = 2000 + yy;
  if (mm < 1 || mm > 12) return -1;
  if (dd == 0) {
    dd = days_in_month[mm - 1];
    if (mm == 2 && (year % 4 == 0 && (year % 100 != 0 || year % 400 == 0))) dd = 29;
  } else if (dd > 31) {
    return -1;
  }
  out[0] = (char)('0' + year / 1000 % 10);
  // prosty sprintf bez stdio:
  int y = year;
  out[3] = (char)('0' + y % 10); y /= 10;
  out[2] = (char)('0' + y % 10); y /= 10;
  out[1] = (char)('0' + y % 10); y /= 10;
  out[0] = (char)('0' + y % 10);
  out[4] = '-';
  out[5] = (char)('0' + mm / 10);
  out[6] = (char)('0' + mm % 10);
  out[7] = '-';
  out[8] = (char)('0' + dd / 10);
  out[9] = (char)('0' + dd % 10);
  out[10] = '\0';
  return 0;
}

static int put_field(gs1_result_t *r, char *dst, size_t dst_size, const uint8_t *src, size_t n) {
  (void)r;
  if (n >= dst_size) return -1;
  memcpy(dst, src, n);
  dst[n] = '\0';
  return 0;
}

int gs1_parse(const uint8_t *raw, size_t len, gs1_result_t *result) {
  memset(result, 0, sizeof(*result));

  // AIM ID: ']' + litera + cyfra
  if (len >= 3 && raw[0] == ']') {
    memcpy(result->aim, raw, 3);
    result->aim[3] = '\0';
    raw += 3;
    len -= 3;
  }

  size_t i = 0;
  int any = 0;
  while (i < len) {
    if (raw[i] == GS) {
      i++;
      continue;
    }
    if (i + 2 > len) return GS1_ERR_TRUNCATED;
    char ai[3] = {(char)raw[i], (char)raw[i + 1], 0};
    i += 2;

    if (strcmp(ai, "01") == 0) {
      if (i + 14 > len || !is_digits(raw + i, 14)) return GS1_ERR_BAD_FIXED;
      if (put_field(result, result->gtin, sizeof(result->gtin), raw + i, 14)) return GS1_ERR_TOO_LONG;
      i += 14;
    } else if (strcmp(ai, "17") == 0) {
      if (i + 6 > len || !is_digits(raw + i, 6)) return GS1_ERR_BAD_FIXED;
      if (put_field(result, result->expiry, sizeof(result->expiry), raw + i, 6)) return GS1_ERR_TOO_LONG;
      gs1_date_to_iso(result->expiry, result->expiry_iso, sizeof(result->expiry_iso));
      i += 6;
    } else if (strcmp(ai, "10") == 0 || strcmp(ai, "21") == 0) {
      size_t j = i;
      while (j < len && raw[j] != GS) j++;
      size_t n = j - i;
      if (n == 0 || n > 20) return GS1_ERR_BAD_VARIABLE;
      char *dst = (ai[1] == '0') ? result->lot : result->serial;
      size_t dst_size = (ai[1] == '0') ? sizeof(result->lot) : sizeof(result->serial);
      if (put_field(result, dst, dst_size, raw + i, n)) return GS1_ERR_TOO_LONG;
      i = j;
    } else {
      return GS1_ERR_UNKNOWN_AI;
    }
    any = 1;
  }
  return any ? GS1_OK : GS1_ERR_EMPTY;
}
