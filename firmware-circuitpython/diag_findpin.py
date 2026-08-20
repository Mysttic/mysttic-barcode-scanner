# DIAGNOSTYKA 3: na ktorym pinie siedzi TXD skanera?
# Monitoruje GP0-GP8 + GP16/GP17, co 8 s raportuje aktywnosc i stany.
import time

import board
import digitalio

NAMES = ["GP0", "GP1", "GP2", "GP3", "GP4", "GP5", "GP6", "GP7", "GP8", "GP16", "GP17"]
ios = []
for name in NAMES:
    p = digitalio.DigitalInOut(getattr(board, name))
    p.direction = digitalio.Direction.INPUT
    ios.append((name, p))

print("Szukam TXD - skanuj kody caly czas!")
while True:
    states = {}
    counts = {}
    for name, p in ios:
        states[name] = p.value
        counts[name] = 0
    t0 = time.monotonic()
    while time.monotonic() - t0 < 8.0:
        for name, p in ios:
            v = p.value
            if v != states[name]:
                counts[name] += 1
                states[name] = v
    active = [(n, c) for n, c in counts.items() if c > 0]
    high = [n for n, p in ios if p.value]
    print("AKTYWNE:", active if active else "brak", "| STAN HIGH:", ",".join(high) if high else "zaden")
