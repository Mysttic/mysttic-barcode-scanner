# Odbior ramek ze skanera po UART.
# Trzyma bufor SUROWYCH bajtow (separator GS 0x1D przechodzi nietkniety),
# konczy skan po skonfigurowanym terminatorze albo po ciszy frame_timeout.
import time


class ScannerUart:
    def __init__(self, uart, terminators=(0x0D, 0x0A), frame_timeout=0.25):
        self._uart = uart
        self._terminators = tuple(terminators)
        self._frame_timeout = frame_timeout
        self._buf = b""
        self._last_rx = time.monotonic()

    def reconfigure(self, terminators=None, frame_timeout=None):
        if terminators is not None:
            self._terminators = tuple(terminators)
        if frame_timeout is not None:
            self._frame_timeout = frame_timeout

    def _find_terminator(self, data):
        best = -1
        for t in self._terminators:
            i = data.find(bytes([t]))
            if i >= 0 and (best < 0 or i < best):
                best = i
        return best

    def poll(self):
        """Zwraca jedna pelna ramke (bytes, bez terminatora) albo None."""
        data = self._uart.read(64)
        now = time.monotonic()
        if data:
            self._buf += data
            self._last_rx = now
        while True:
            idx = self._find_terminator(self._buf)
            if idx < 0:
                break
            frame, self._buf = self._buf[:idx], self._buf[idx + 1 :]
            if frame:
                return frame
        if self._buf and (now - self._last_rx) > self._frame_timeout:
            frame, self._buf = self._buf, b""
            return frame
        return None
