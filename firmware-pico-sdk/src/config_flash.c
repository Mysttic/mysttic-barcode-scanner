// Trwaly zapis konfiguracji: DWA sloty (A/B) w ostatnich sektorach flasha.
// Zapis atomowy: nowy zapis idzie ZAWSZE do przeciwnego slotu z licznikiem
// seq+1; odczyt wybiera slot z poprawnym CRC i wyzszym seq. Przerwany zapis
// zostawia poprzedni slot nietkniety.
#include <string.h>

#include "config_store.h"
#include "hardware/flash.h"
#include "pico/flash.h"

#define SLOT_SIZE FLASH_SECTOR_SIZE  // 4096
#define SLOTS_OFFSET (PICO_FLASH_SIZE_BYTES - 2 * SLOT_SIZE)
#define SLOT_OFFSET(i) (SLOTS_OFFSET + (uint32_t)(i) * SLOT_SIZE)
#define SLOT_ADDR(i) ((const uint8_t *)(XIP_BASE + SLOT_OFFSET(i)))

#define MAGIC0 'B'
#define MAGIC1 'C'
#define HDR_LEN 12  // magic(2) ver(1) pad(1) seq(4) len(2) crc(2)

static uint16_t crc16(const uint8_t *data, size_t len) {
  uint16_t crc = 0;
  for (size_t i = 0; i < len; i++) {
    crc ^= (uint16_t)(data[i] << 8);
    for (int b = 0; b < 8; b++)
      crc = (crc & 0x8000) ? (uint16_t)((crc << 1) ^ 0x1021) : (uint16_t)(crc << 1);
  }
  return crc;
}

static int slot_valid(int i, uint32_t *seq_out, const char **json_out, uint16_t *len_out) {
  const uint8_t *s = SLOT_ADDR(i);
  if (s[0] != MAGIC0 || s[1] != MAGIC1 || s[2] != 1) return 0;
  uint32_t seq = (uint32_t)s[4] | ((uint32_t)s[5] << 8) | ((uint32_t)s[6] << 16) | ((uint32_t)s[7] << 24);
  uint16_t len = (uint16_t)(s[8] | (s[9] << 8));
  uint16_t crc = (uint16_t)(s[10] | (s[11] << 8));
  if (len == 0 || len > SLOT_SIZE - HDR_LEN || len >= CFG_RAW_JSON_MAX) return 0;
  if (crc16(s + HDR_LEN, len) != crc) return 0;
  *seq_out = seq;
  *json_out = (const char *)(s + HDR_LEN);
  *len_out = len;
  return 1;
}

typedef struct {
  int slot;
  uint8_t buf[SLOT_SIZE];
} flash_op_t;

static void do_flash_write(void *param) {
  flash_op_t *op = (flash_op_t *)param;
  flash_range_erase(SLOT_OFFSET(op->slot), SLOT_SIZE);
  flash_range_program(SLOT_OFFSET(op->slot), op->buf, SLOT_SIZE);
}

static void do_flash_erase_both(void *param) {
  (void)param;
  flash_range_erase(SLOTS_OFFSET, 2 * SLOT_SIZE);
}

bool config_flash_load(config_t *cfg) {
  uint32_t seq[2];
  const char *json[2];
  uint16_t len[2];
  int ok0 = slot_valid(0, &seq[0], &json[0], &len[0]);
  int ok1 = slot_valid(1, &seq[1], &json[1], &len[1]);
  int pick = -1;
  if (ok0 && ok1) pick = (seq[1] > seq[0]) ? 1 : 0;
  else if (ok0) pick = 0;
  else if (ok1) pick = 1;
  if (pick < 0) return false;
  return config_parse(json[pick], len[pick], cfg) == NULL;
}

static uint32_t current_seq_and_slot(int *newest_slot) {
  uint32_t seq[2];
  const char *json;
  uint16_t len;
  int ok0 = slot_valid(0, &seq[0], &json, &len);
  int ok1 = slot_valid(1, &seq[1], &json, &len);
  *newest_slot = -1;
  uint32_t s = 0;
  if (ok0) { *newest_slot = 0; s = seq[0]; }
  if (ok1 && (!ok0 || seq[1] > seq[0])) { *newest_slot = 1; s = seq[1]; }
  return s;
}

const char *config_flash_save(const config_t *cfg) {
  static flash_op_t op;  // duzy bufor - statycznie
  size_t len = strlen(cfg->raw_json);
  if (len == 0 || len > SLOT_SIZE - HDR_LEN) return "konfiguracja za duza do slotu flash";

  int newest;
  uint32_t seq = current_seq_and_slot(&newest) + 1;
  op.slot = (newest == 0) ? 1 : 0;  // pisz do przeciwnego (lub 0 gdy brak)

  memset(op.buf, 0xFF, sizeof(op.buf));
  op.buf[0] = MAGIC0;
  op.buf[1] = MAGIC1;
  op.buf[2] = 1;
  op.buf[3] = 0;
  op.buf[4] = (uint8_t)(seq & 0xFF);
  op.buf[5] = (uint8_t)((seq >> 8) & 0xFF);
  op.buf[6] = (uint8_t)((seq >> 16) & 0xFF);
  op.buf[7] = (uint8_t)((seq >> 24) & 0xFF);
  op.buf[8] = (uint8_t)(len & 0xFF);
  op.buf[9] = (uint8_t)((len >> 8) & 0xFF);
  uint16_t crc = crc16((const uint8_t *)cfg->raw_json, len);
  op.buf[10] = (uint8_t)(crc & 0xFF);
  op.buf[11] = (uint8_t)((crc >> 8) & 0xFF);
  memcpy(op.buf + HDR_LEN, cfg->raw_json, len);

  if (flash_safe_execute(do_flash_write, &op, 3000) != PICO_OK)
    return "blad zapisu flash";

  // weryfikacja: odczytaj swiezo zapisany slot
  uint32_t vseq;
  const char *vjson;
  uint16_t vlen;
  if (!slot_valid(op.slot, &vseq, &vjson, &vlen) || vseq != seq || vlen != len)
    return "weryfikacja zapisu nieudana";
  return NULL;
}

void config_flash_erase(void) {
  flash_safe_execute(do_flash_erase_both, NULL, 3000);
}
