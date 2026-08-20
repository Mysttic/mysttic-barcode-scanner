# DIAGNOSTYKA 4: rozstrzygniecie 9600 vs 115200.
import time

import board
import busio

while True:
    for baud in [9600, 115200]:
        uart = busio.UART(tx=board.GP0, rx=board.GP1, baudrate=baud, timeout=0.1)
        uart.reset_input_buffer()
        print("=== BAUD", baud, "===")
        t0 = time.monotonic()
        while time.monotonic() - t0 < 10.0:
            data = uart.read(64)
            if data:
                print("BAUD", baud, "| HEX:", data.hex(), "| ASCII:", "".join(chr(b) if 32 <= b < 127 else "." for b in data))
        uart.deinit()
