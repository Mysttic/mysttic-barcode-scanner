# JEDNORAZOWY setup: przelacza GM65 w Sensor mode (induction) komendami UART
# i zapisuje ustawienie do EEPROM skanera. Wgrac jako code.py, po sukcesie
# przywrocic wlasciwy code.py.
# Protokol: manual GM65 sekcja 8 (zone bit 0x0000, bity 1-0: 11 = Sensor mode).
import time

import board
import busio

uart = busio.UART(tx=board.GP0, rx=board.GP1, baudrate=9600, timeout=0.6)


def crc16(data):
    crc = 0
    for b in data:
        crc ^= b << 8
        for _ in range(8):
            crc = ((crc << 1) ^ 0x1021) & 0xFFFF if crc & 0x8000 else (crc << 1) & 0xFFFF
    return crc


def send(types, addr, datas):
    frame = bytes([0x7E, 0x00, types, 0x01, (addr >> 8) & 0xFF, addr & 0xFF]) + bytes(datas)
    c = crc16(frame[1:])
    frame += bytes([(c >> 8) & 0xFF, c & 0xFF])
    uart.reset_input_buffer()
    uart.write(frame)
    print("TX:", frame.hex())
    time.sleep(0.3)
    resp = uart.read(32)
    print("RX:", resp.hex() if resp else "brak odpowiedzi")
    return resp


print("=== Setup Sensor mode ===")
resp = send(0x07, 0x0000, [0x01])  # read zone bit 0x0000
if resp and len(resp) >= 5 and resp[0] == 0x02 and resp[2] == 0x00:
    val = resp[4]
    print("zone 0x0000 =", hex(val), "| tryb (bity1-0) =", val & 0x03)
    new = (val & 0xFC) | 0x03  # Sensor mode
    if new == val:
        print("Sensor mode juz ustawiony")
    else:
        resp = send(0x08, 0x0000, [new])  # write
        if resp and resp[0] == 0x02:
            print("zapis RAM OK ->", hex(new))
        else:
            print("BLAD zapisu RAM")
    resp = send(0x09, 0x0000, [0x00])  # save to EEPROM
    if resp and resp[0] == 0x02:
        print("zapis EEPROM OK - ustawienie trwale")
    else:
        print("BLAD zapisu EEPROM")
else:
    print("BLAD odczytu zone bit - sprawdz polaczenie/predkosc")

print("=== Koniec setup - przywroc wlasciwy code.py ===")
while True:
    time.sleep(1)
