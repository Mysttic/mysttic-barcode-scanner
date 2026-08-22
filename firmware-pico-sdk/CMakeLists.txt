cmake_minimum_required(VERSION 3.13)

# PICO_SDK_PATH bierzemy ze srodowiska (C:/Workspaces/pico-sdk)
include(pico_sdk_import.cmake)

project(barcode_reader C CXX ASM)
set(CMAKE_C_STANDARD 11)

pico_sdk_init()

# Obraz dysku MSC (FAT12, tylko-do-odczytu): konfigurator + instrukcja,
# generowany z repo przy kazdym buildzie
find_package(Python3 COMPONENTS Interpreter REQUIRED)
set(MSC_IMAGE_C ${CMAKE_CURRENT_BINARY_DIR}/msc_image.c)
set(REPO_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/..)
set(MSC_INPUTS
  "konfigurator.html=${REPO_ROOT}/configurator/dist/index.html"
  "INSTRUKCJA.md=${CMAKE_CURRENT_SOURCE_DIR}/msc_files/INSTRUKCJA.md"
  "CZYTAJ.TXT=${CMAKE_CURRENT_SOURCE_DIR}/msc_files/CZYTAJ.TXT"
  "WTYCZKA.md=${REPO_ROOT}/docs/WTYCZKA.md"
  "NAUKA-PROFILU.md=${REPO_ROOT}/docs/NAUKA-PROFILU.md"
  "testy.html=${REPO_ROOT}/test-vectors/testy.html"
  "formularze/forma-a-tab.html=${REPO_ROOT}/test-vectors/formularze/forma-a-tab.html"
  "formularze/forma-b-nazwy.html=${REPO_ROOT}/test-vectors/formularze/forma-b-nazwy.html"
  "formularze/forma-gs1.html=${REPO_ROOT}/test-vectors/formularze/forma-gs1.html"
  "formularze/forma-c-wtyczka.html=${REPO_ROOT}/test-vectors/formularze/forma-c-wtyczka.html"
  "formularze/forma-c-lek.html=${REPO_ROOT}/test-vectors/formularze/forma-c-lek.html"
)
set(MSC_FILE_ARGS "")
set(MSC_DEPS ${REPO_ROOT}/tools/make_msc_image.py)
foreach(spec ${MSC_INPUTS})
  list(APPEND MSC_FILE_ARGS --file ${spec})
  string(REGEX REPLACE "^[^=]+=" "" src ${spec})
  list(APPEND MSC_DEPS ${src})
endforeach()
add_custom_command(
  OUTPUT ${MSC_IMAGE_C}
  COMMAND ${Python3_EXECUTABLE} ${REPO_ROOT}/tools/make_msc_image.py
          --out ${MSC_IMAGE_C} --label CZYTNIK ${MSC_FILE_ARGS}
  DEPENDS ${MSC_DEPS}
  COMMENT "Generowanie obrazu dysku MSC (konfigurator + instrukcja + formularze testowe)"
)

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
  src/msc_disk.c
  ${MSC_IMAGE_C}
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
