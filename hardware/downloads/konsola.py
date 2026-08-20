import sys
import time

import serial

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

PORT = "COM4"  # MI_00 = konsola CircuitPythona
DURATION_S = 240

try:
    s = serial.Serial(PORT, 115200, timeout=0.2)
except Exception as e:
    print("Nie moge otworzyc", PORT, "-", e)
    sys.exit(1)

s.dtr = True
s.rts = True
print("Otwarty", PORT, "- wysylam Ctrl+C / Ctrl+D")
s.write(b"\x03")
time.sleep(0.3)
s.write(b"\x04")

t0 = time.time()
buf = b""
while time.time() - t0 < DURATION_S:
    data = s.read(4096)
    if data:
        buf += data
        while b"\n" in buf:
            line, _, buf = buf.partition(b"\n")
            text = line.decode("utf-8", "replace").rstrip()
            if text:
                print("[KONSOLA]", text, flush=True)

s.close()
print("KONIEC NASLUCHU")
