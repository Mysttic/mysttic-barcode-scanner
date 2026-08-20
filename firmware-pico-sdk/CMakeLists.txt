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
)

target_include_directories(barcode_reader PRIVATE src)

target_link_libraries(barcode_reader
  pico_stdlib
  pico_unique_id
  hardware_uart
  tinyusb_device
  tinyusb_board
)

pico_add_extra_outputs(barcode_reader)
