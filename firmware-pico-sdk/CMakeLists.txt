cmake_minimum_required(VERSION 3.13)

# PICO_SDK_PATH bierzemy ze srodowiska (patrz CONTRIBUTING.md)
include(pico_sdk_import.cmake)

project(mysttic_barcode_scanner C CXX ASM)
set(CMAKE_C_STANDARD 11)

pico_sdk_init()

# Obraz dysku MSC (FAT12, tylko-do-odczytu): konfigurator + instrukcja,
# generowany z repo przy kazdym buildzie
find_package(Python3 COMPONENTS Interpreter REQUIRED)
set(MSC_IMAGE_C ${CMAKE_CURRENT_BINARY_DIR}/msc_image.c)
set(REPO_ROOT ${CMAKE_CURRENT_SOURCE_DIR}/..)
set(MSC_INPUTS
  "configurator.html=${REPO_ROOT}/configurator/dist/index.html"
  "MANUAL.md=${CMAKE_CURRENT_SOURCE_DIR}/msc_files/MANUAL.md"
  "README.TXT=${CMAKE_CURRENT_SOURCE_DIR}/msc_files/README.TXT"
  "BROWSER-EXTENSION.md=${REPO_ROOT}/docs/browser-extension.md"
  "tests.html=${REPO_ROOT}/test-vectors/tests.html"
  "forms/form-a-tab.html=${REPO_ROOT}/test-vectors/forms/form-a-tab.html"
  "forms/form-b-names.html=${REPO_ROOT}/test-vectors/forms/form-b-names.html"
  "forms/form-gs1.html=${REPO_ROOT}/test-vectors/forms/form-gs1.html"
  "forms/form-c-extension.html=${REPO_ROOT}/test-vectors/forms/form-c-extension.html"
  "forms/form-c-medicine.html=${REPO_ROOT}/test-vectors/forms/form-c-medicine.html"
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
          --out ${MSC_IMAGE_C} --label MYSTTIC ${MSC_FILE_ARGS}
  DEPENDS ${MSC_DEPS}
  COMMENT "Generowanie obrazu dysku MSC (konfigurator + instrukcja + formularze testowe)"
)

add_executable(mysttic_barcode_scanner
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

target_include_directories(mysttic_barcode_scanner PRIVATE src)

# Wersja wydania: VERSION.md w korzeniu repo jest jedynym zrodlem prawdy.
file(READ ${REPO_ROOT}/VERSION.md _version_md)
string(REGEX MATCH "[0-9]+\\.[0-9]+\\.[0-9]+" FW_VERSION "${_version_md}")
if(NOT FW_VERSION)
  set(FW_VERSION "0.0.0-dev")
endif()
message(STATUS "Wersja firmware (z VERSION.md): ${FW_VERSION}")
target_compile_definitions(mysttic_barcode_scanner PRIVATE FIRMWARE_VERSION_C="${FW_VERSION}")

target_link_libraries(mysttic_barcode_scanner
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

pico_add_extra_outputs(mysttic_barcode_scanner)
