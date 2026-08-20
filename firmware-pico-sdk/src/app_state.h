#ifndef APP_STATE_H_
#define APP_STATE_H_

#include <stdbool.h>

#include "config_store.h"

typedef enum { RESET_NONE = 0, RESET_NORMAL, RESET_BOOTLOADER } pending_reset_t;

typedef struct {
  config_t cfg;
  bool test_mode;
  bool config_dirty;  // main ma przeladowac UART/framer po setConfig
  pending_reset_t pending_reset;
} app_state_t;

extern app_state_t app_state;

#endif
