#ifndef PROFILE_MATCHER_H_
#define PROFILE_MATCHER_H_

#include <stddef.h>
#include <stdint.h>

#include "config_store.h"

#define PM_MAX_ACTIONS 24

enum { PM_MATCHED = 0, PM_FALLBACK = 1, PM_SKIPPED = 2, PM_EMPTY = 3, PM_NO_MATCH = 4, PM_PARSE_ERROR = 5 };

typedef struct {
  cfg_action_t items[PM_MAX_ACTIONS];
  int count;
} pm_actions_t;

// Buduje liste akcji dla surowej ramki. Zwraca PM_MATCHED / PM_FALLBACK /
// PM_SKIPPED (onError=skip) / PM_EMPTY (nie-ASCII lub pusta).
int pm_build_actions(const config_t *cfg, const uint8_t *raw, size_t raw_len, pm_actions_t *acts);

#endif
