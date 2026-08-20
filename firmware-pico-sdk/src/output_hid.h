#ifndef OUTPUT_HID_H_
#define OUTPUT_HID_H_

#include <stdbool.h>
#include <stdint.h>

void output_hid_queue_text(const char *text);
void output_hid_queue_key(uint8_t keycode);  // HID_KEY_* z tusb
void output_hid_task(void);
bool output_hid_idle(void);
void output_hid_set_delays(int key_delay_ms, int action_delay_ms);

#endif
