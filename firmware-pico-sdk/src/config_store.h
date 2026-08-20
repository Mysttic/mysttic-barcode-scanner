#ifndef CONFIG_STORE_H_
#define CONFIG_STORE_H_

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#define CFG_MAX_PROFILES 6
#define CFG_MAX_FIELDS 8
#define CFG_MAX_ACTIONS 16
#define CFG_RAW_JSON_MAX 4096

typedef enum { PARSE_REGEX_GROUPS = 0, PARSE_GS1 = 1 } parse_type_t;
typedef enum { ACT_FIELD = 0, ACT_KEY = 1, ACT_TEXT = 2 } action_type_t;
typedef enum { OUT_PASSTHROUGH = 0, OUT_SPLIT = 1 } out_mode_t;
typedef enum { ONERR_RAW = 0, ONERR_SKIP = 1 } on_error_t;

typedef struct {
  action_type_t type;
  char value[64];  // nazwa pola / nazwa klawisza / tekst
} cfg_action_t;

typedef struct {
  char name[32];
  bool enabled;
  char detect_pattern[128];
  parse_type_t parse_type;
  char parse_pattern[192];  // pusty = uzyj detect_pattern
  struct {
    char name[16];
    int group;
  } fields[CFG_MAX_FIELDS];
  int field_count;
  cfg_action_t output[CFG_MAX_ACTIONS];
  int output_count;
} cfg_profile_t;

typedef struct {
  int baudrate;
  uint8_t terminators[4];
  int term_count;
  int frame_timeout_ms;
  int duplicate_block_ms;
  int key_delay_ms;
  int action_delay_ms;
  out_mode_t out_mode;
  int split_at;
  char suffix_key[12];
  char prefix_text[32];
  char suffix_text[32];
  on_error_t on_error;
  cfg_profile_t profiles[CFG_MAX_PROFILES];
  int profile_count;
  char raw_json[CFG_RAW_JSON_MAX];  // oryginalny JSON (do getConfig/save)
} config_t;

// Parsuje i waliduje JSON do *cfg. Zwraca NULL albo opis bledu (statyczny bufor).
const char *config_parse(const char *json, size_t len, config_t *cfg);
void config_defaults(config_t *cfg);

// Trwaly zapis: dwa sloty A/B na koncu flasha, wybor po liczniku seq + CRC.
// (implementacja flashowa tylko na urzadzeniu; na hoscie niedostepna)
bool config_flash_load(config_t *cfg);
const char *config_flash_save(const config_t *cfg);
void config_flash_erase(void);

#endif
