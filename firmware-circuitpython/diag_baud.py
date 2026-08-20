# DIAGNOSTYKA: szukanie wlasciwego baud rate skanera.
# Nie pisze po HID. Co 6 s zmienia predkosc i wypisuje kazdy odebrany bajt.
# Wgrac jako code.py na CIRCUITPY, po diagnozie przywrocic wlasciwy code.py.
import time

import board
import busio

BAUDS = [9600, 115200, 57600, 19200, 38400, 14400]

while True:
    for baud in BAUDS:
        uart = busio.UART(tx=board.GP0, rx=board.GP1, baudrate=baud, timeout=0.1)
        print("=== BAUD", baud, "- skanuj teraz ===")
        t0 = time.monotonic()
        while time.monotonic() - t0 < 6.0:
            data = uart.read(64)
            if data:
                print("BAUD", baud, "| HEX:", data.hex(), "| ASCII:", "".join(chr(b) if 32 <= b < 127 else "." for b in data))
        uart.deinit()
