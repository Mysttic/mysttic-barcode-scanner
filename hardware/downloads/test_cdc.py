import json
import sys
import time

import serial

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

s = serial.Serial("COM5", 115200, timeout=0.2)
s.dtr = True
s.rts = True
buf = b""


def send(obj):
    s.write((json.dumps(obj) + "\n").encode())
    print(">>", json.dumps(obj))


def pump(seconds):
    global buf
    t0 = time.time()
    while time.time() - t0 < seconds:
        data = s.read(4096)
        if data:
            buf += data
            while b"\n" in buf:
                line, _, buf = buf.partition(b"\n")
                if line.strip():
                    print("<<", line.decode("utf-8", "replace").strip(), flush=True)


send({"cmd": "ping", "requestId": 1})
pump(1)
send({"cmd": "getConfig", "requestId": 2})
pump(1)
send({"cmd": "nieistnieje", "requestId": 3})
pump(1)
send({"cmd": "setMode", "mode": "test", "requestId": 4})
pump(1)
print("--- TRYB TEST: zbliz kod do skanera (czekam 30 s) ---")
pump(30)
send({"cmd": "setMode", "mode": "hid", "requestId": 5})
pump(1)
s.close()
print("--- KONIEC TESTU CDC ---")
