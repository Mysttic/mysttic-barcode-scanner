cmake_minimum_required(VERSION 3.13)

# PICO_SDK_PATH bierzemy ze srodowiska (C:/Workspaces/pico-sdk)
include(pico_sdk_import.cmake)

project(barcode_reader C CXX ASM)
set(CMAKE_C_STANDARD 11)

pico_sdk_init()

add_executable(barcode_reader
  src/main.c
  src/usb_descriptors.c
  src/protocol_cdc.c
  src/output_hid.c
  src/scan_framer.c
  src/parser_gs1.c
  src/mini_regex.c
  src/config_parse.c
  src/config_flash.c
  src/profile_matcher.c
)

target_include_directories(barcode_reader PRIVATE src)

target_link_libraries(barcode_reader
  pico_stdlib
  pico_unique_id
  pico_flash
  pico_bootrom
  hardware_uart
  hardware_flash
  hardware_watchdog
  tinyusb_device
  tinyusb_board
)

pico_add_extra_outputs(barcode_reader)
