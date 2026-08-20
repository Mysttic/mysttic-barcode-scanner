# Prototyp Etapu 2 (wersja MicroPython) - odbior z GM65 na UART0 (GP0=TX, GP1=RX).
# Docelowy firmware wg instrukcji to CircuitPython + adafruit_hid (USB HID);
# ten plik to referencja polaczen i logiki odbioru ramek.
#
# UWAGA o symulatorze Wokwi (stan na 2026-08): machine.UART na wokwi-pi-pico
# nie dziala (konstruktor sie zawiesza, a UART0 koliduje z konsola REPL).
# W symulacji nie zobaczysz wiec odbioru - dziala za to atrapa GM65
# (gm65.chip.c), ktora loguje wysylane ramki w zakladce CHIPS CONSOLE.
# Schemat polaczen jest 1:1 z instrukcja z Notion i na prawdziwym Pico dziala.
from machine import UART, Pin

uart = UART(0, baudrate=9600, tx=Pin(0), rx=Pin(1), timeout=200)
led = Pin(6, Pin.OUT)

buf = b""
while True:
    data = uart.read(64)
    if not data:
        continue
    buf += data
    while b"\n" in buf:
        idx = buf.find(b"\n")
        line, buf = buf[:idx], buf[idx + 1:]
        code = line.strip()
        if code:
            print("SKAN:", code.decode(), "| HEX:", code.hex())
            led.toggle()
