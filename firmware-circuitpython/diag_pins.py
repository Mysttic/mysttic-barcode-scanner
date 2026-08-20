# DIAGNOSTYKA 2: aktywnosc elektryczna na GP0 i GP1.
# Liczy zmiany stanu na obu pinach w oknach 8 s - skanuj w trakcie.
# Pin podlaczony do TXD skanera pokaze zmiany przy kazdym skanie.
import time

import board
import digitalio

p0 = digitalio.DigitalInOut(board.GP0)
p0.direction = digitalio.Direction.INPUT
p1 = digitalio.DigitalInOut(board.GP1)
p1.direction = digitalio.Direction.INPUT

print("Start pomiaru aktywnosci GP0/GP1 - skanuj kody!")
while True:
    s0, s1 = p0.value, p1.value
    c0 = c1 = 0
    t0 = time.monotonic()
    while time.monotonic() - t0 < 8.0:
        v0, v1 = p0.value, p1.value
        if v0 != s0:
            c0 += 1
            s0 = v0
        if v1 != s1:
            c1 += 1
            s1 = v1
    print("GP0: zmian =", c0, "stan =", "HIGH" if p0.value else "LOW", "| GP1: zmian =", c1, "stan =", "HIGH" if p1.value else "LOW")
