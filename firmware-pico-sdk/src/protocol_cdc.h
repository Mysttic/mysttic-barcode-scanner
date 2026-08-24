#ifndef PROTOCOL_CDC_H_
#define PROTOCOL_CDC_H_

// Wersja wstrzykiwana przy buildzie z VERSION.md (CMakeLists.txt).
// Fallback ponizej oznacza build z pominieciem CMake - np. testy hostowe.
#ifndef FIRMWARE_VERSION_C
#define FIRMWARE_VERSION_C "0.0.0-dev"
#endif

void protocol_cdc_task(void);
void cdc_send_line(const char *json);

#endif
