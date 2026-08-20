// Wysylanie tekstu i klawiszy jako klawiatura HID (uklad US).
#include "output_hid.h"

#include "bsp/board_api.h"
#include "tusb.h"

// Mapa ASCII -> {keycode, shift} dla ukladu US.
typedef struct {
  uint8_t keycode;
  uint8_t shift;
} key_map_t;

static key_map_t ascii_to_key(char c) {
  key_map_t k = {0, 0};
  if (c >= 'a' && c <= 'z') {
    k.keycode = (uint8_t)(HID_KEY_A + (c - 'a'));
  } else if (c >= 'A' && c <= 'Z') {
    k.keycode = (uint8_t)(HID_KEY_A + (c - 'A'));
    k.shift = 1;
  } else if (c >= '1' && c <= '9') {
    k.keycode = (uint8_t)(HID_KEY_1 + (c - '1'));
  } else {
    switch (c) {
      case '0': k.keycode = HID_KEY_0; break;
      case ' ': k.keycode = HID_KEY_SPACE; break;
      case '-': k.keycode = HID_KEY_MINUS; break;
      case '=': k.keycode = HID_KEY_EQUAL; break;
      case '[': k.keycode = HID_KEY_BRACKET_LEFT; break;
      case ']': k.keycode = HID_KEY_BRACKET_RIGHT; break;
      case '\\': k.keycode = HID_KEY_BACKSLASH; break;
      case ';': k.keycode = HID_KEY_SEMICOLON; break;
      case '\'': k.keycode = HID_KEY_APOSTROPHE; break;
      case '`': k.keycode = HID_KEY_GRAVE; break;
      case ',': k.keycode = HID_KEY_COMMA; break;
      case '.': k.keycode = HID_KEY_PERIOD; break;
      case '/': k.keycode = HID_KEY_SLASH; break;
      case '!': k.keycode = HID_KEY_1; k.shift = 1; break;
      case '@': k.keycode = HID_KEY_2; k.shift = 1; break;
      case '#': k.keycode = HID_KEY_3; k.shift = 1; break;
      case '$': k.keycode = HID_KEY_4; k.shift = 1; break;
      case '%': k.keycode = HID_KEY_5; k.shift = 1; break;
      case '^': k.keycode = HID_KEY_6; k.shift = 1; break;
      case '&': k.keycode = HID_KEY_7; k.shift = 1; break;
      case '*': k.keycode = HID_KEY_8; k.shift = 1; break;
      case '(': k.keycode = HID_KEY_9; k.shift = 1; break;
      case ')': k.keycode = HID_KEY_0; k.shift = 1; break;
      case '_': k.keycode = HID_KEY_MINUS; k.shift = 1; break;
      case '+': k.keycode = HID_KEY_EQUAL; k.shift = 1; break;
      case '{': k.keycode = HID_KEY_BRACKET_LEFT; k.shift = 1; break;
      case '}': k.keycode = HID_KEY_BRACKET_RIGHT; k.shift = 1; break;
      case '|': k.keycode = HID_KEY_BACKSLASH; k.shift = 1; break;
      case ':': k.keycode = HID_KEY_SEMICOLON; k.shift = 1; break;
      case '"': k.keycode = HID_KEY_APOSTROPHE; k.shift = 1; break;
      case '~': k.keycode = HID_KEY_GRAVE; k.shift = 1; break;
      case '<': k.keycode = HID_KEY_COMMA; k.shift = 1; break;
      case '>': k.keycode = HID_KEY_PERIOD; k.shift = 1; break;
      case '?': k.keycode = HID_KEY_SLASH; k.shift = 1; break;
      default: break;  // znak bez mapowania - pomijany
    }
  }
  return k;
}

// Kolejka zdarzen klawiszy: kazdy znak = press + release.
#define KEYQ_SIZE 512
typedef struct {
  uint8_t keycode;
  uint8_t modifier;
  uint8_t delay_after;  // 0 = keyDelay, 1 = actionDelay (po klawiszu specjalnym)
} key_event_t;

static key_event_t keyq[KEYQ_SIZE];
static volatile size_t keyq_head = 0, keyq_tail = 0;
static int g_key_delay_ms = 10;
static int g_action_delay_ms = 30;
static uint32_t g_next_allowed_ms = 0;

void output_hid_set_delays(int key_delay_ms, int action_delay_ms) {
  g_key_delay_ms = key_delay_ms < 0 ? 0 : key_delay_ms;
  g_action_delay_ms = action_delay_ms < 0 ? 0 : action_delay_ms;
}

static int keyq_push(uint8_t keycode, uint8_t modifier, uint8_t delay_after) {
  size_t next = (keyq_head + 1) % KEYQ_SIZE;
  if (next == keyq_tail) return -1;  // pelna
  keyq[keyq_head].keycode = keycode;
  keyq[keyq_head].modifier = modifier;
  keyq[keyq_head].delay_after = delay_after;
  keyq_head = next;
  return 0;
}

void output_hid_queue_text(const char *text) {
  for (const char *p = text; *p; p++) {
    key_map_t k = ascii_to_key(*p);
    if (!k.keycode) continue;
    keyq_push(k.keycode, k.shift ? KEYBOARD_MODIFIER_LEFTSHIFT : 0, 0);
    keyq_push(0, 0, 0);  // release
  }
}

void output_hid_queue_key(uint8_t keycode) {
  keyq_push(keycode, 0, 0);
  keyq_push(0, 0, 1);  // po klawiszu specjalnym dluzsza pauza (actionDelay)
}

bool output_hid_idle(void) { return keyq_head == keyq_tail; }

// Wolane z petli glownej: wysyla nastepne zdarzenie, gdy HID gotowy
// i minelo skonfigurowane opoznienie (nieblokujaco).
void output_hid_task(void) {
  if (keyq_head == keyq_tail) return;
  if (!tud_hid_ready()) return;
  uint32_t now = board_millis();
  if ((int32_t)(now - g_next_allowed_ms) < 0) return;
  key_event_t ev = keyq[keyq_tail];
  uint8_t keys[6] = {ev.keycode, 0, 0, 0, 0, 0};
  if (tud_hid_keyboard_report(0, ev.modifier, ev.keycode ? keys : NULL)) {
    keyq_tail = (keyq_tail + 1) % KEYQ_SIZE;
    if (!ev.keycode)  // po release odczekaj key/action delay
      g_next_allowed_ms = now + (uint32_t)(ev.delay_after ? g_action_delay_ms : g_key_delay_ms);
  }
}
