// USB MSC: dysk tylko-do-odczytu z konfiguratorem i instrukcja.
// Obraz FAT12 generowany przy buildzie (tools/make_msc_image.py) i wbudowany
// w firmware (XIP flash) - konfiguracja czytnika NIE lezy na tym dysku,
// zyje w slotach flash obslugiwanych przez config_flash.c.
#include <string.h>

#include "tusb.h"

extern const uint8_t msc_image[];
extern const uint32_t msc_image_size;

#define BLOCK_SIZE 512u

void tud_msc_inquiry_cb(uint8_t lun, uint8_t vendor_id[8], uint8_t product_id[16],
                        uint8_t product_rev[4]) {
  (void)lun;
  memcpy(vendor_id, "BARCODE ", 8);
  memcpy(product_id, "CZYTNIK KONFIG  ", 16);
  memcpy(product_rev, "1.0 ", 4);
}

bool tud_msc_test_unit_ready_cb(uint8_t lun) {
  (void)lun;
  return true;
}

void tud_msc_capacity_cb(uint8_t lun, uint32_t *block_count, uint16_t *block_size) {
  (void)lun;
  *block_count = msc_image_size / BLOCK_SIZE;
  *block_size = BLOCK_SIZE;
}

bool tud_msc_is_writable_cb(uint8_t lun) {
  (void)lun;
  return false;  // dysk tylko-do-odczytu
}

bool tud_msc_start_stop_cb(uint8_t lun, uint8_t power_condition, bool start, bool load_eject) {
  (void)lun;
  (void)power_condition;
  (void)start;
  (void)load_eject;  // "wysun" z systemu jest nieszkodliwy - obraz siedzi we flashu
  return true;
}

int32_t tud_msc_read10_cb(uint8_t lun, uint32_t lba, uint32_t offset, void *buffer,
                          uint32_t bufsize) {
  (void)lun;
  uint32_t addr = lba * BLOCK_SIZE + offset;
  if (addr >= msc_image_size) return -1;
  uint32_t n = msc_image_size - addr;
  if (n > bufsize) n = bufsize;
  memcpy(buffer, msc_image + addr, n);
  return (int32_t)n;
}

int32_t tud_msc_write10_cb(uint8_t lun, uint32_t lba, uint32_t offset, uint8_t *buffer,
                           uint32_t bufsize) {
  (void)lun;
  (void)lba;
  (void)offset;
  (void)buffer;
  (void)bufsize;
  return -1;  // nieosiagalne przy is_writable=false; twarda odmowa na wszelki wypadek
}

int32_t tud_msc_scsi_cb(uint8_t lun, uint8_t const scsi_cmd[16], void *buffer, uint16_t bufsize) {
  (void)buffer;
  (void)bufsize;
  switch (scsi_cmd[0]) {
    default:
      // nieobslugiwana komenda SCSI: zglos ILLEGAL REQUEST
      tud_msc_set_sense(lun, SCSI_SENSE_ILLEGAL_REQUEST, 0x20, 0x00);
      return -1;
  }
}
