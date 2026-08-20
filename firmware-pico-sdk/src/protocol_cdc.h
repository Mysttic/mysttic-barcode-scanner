#ifndef PROTOCOL_CDC_H_
#define PROTOCOL_CDC_H_

#define FIRMWARE_VERSION_C "0.0.0-dev"

void protocol_cdc_task(void);
void cdc_send_line(const char *json);

#endif
